import { Page } from 'puppeteer'
import axios from 'axios'
import { MAX_RETRIES } from '../../constants'
import { createWriteStream, existsPath, imagesToS3, loadPage, makeDirectory, productToS3, readJson, sleep, startBrowser, writeFile, writeJson } from '../../library'
import { ProductBase, ProductExtendedBase } from '../../interfaces'
import { ZenRows } from 'zenrows'

export type PostProcessing = (fileName: string) => void
export type ProductDetails = (page: Page, Id?: string) => Promise<any>
export type ProductLinks = (page: Page) => Promise<ProductBase[]>

export abstract class ProductAncestor {
  protected productDetailsFn?: ProductDetails
  protected productLinksFn?: ProductLinks
  protected imagesFolder: string
  protected products: ProductBase[]
  protected productsFile: string
  protected postProcessingFn: PostProcessing[]
  protected productsFolder: string
  private bucket: string

  protected assignPostProcessing(postProcessing: PostProcessing[]): void { this.postProcessingFn = postProcessing }
  protected assignProductDetails(productDetails: ProductDetails): void { this.productDetailsFn = productDetails }
  protected assignProductLinks(productLinks: ProductLinks): void { this.productLinksFn = productLinks }

  constructor(folder: string, bucket: string) {
    this.postProcessingFn = []
    this.bucket = bucket
    this.productsFile = `${folder}/produtos.json`
    this.imagesFolder = `${folder}/imagens`
    this.productsFolder = `${folder}/produtos`
    this.products = []
  }

  protected async getProductLinks(url: string): Promise<ProductBase[]> {
    const browser = await startBrowser()
    let retries = 0
  
    do {
      try {
        const page = await loadPage(browser, url)
        const productsPage = await this.productLinksFn!(page)
  
        await browser.close()
      
        return productsPage
      } catch (error) {
        console.log(`Erro ao processar página: ${url}.\nTentativa ${++retries} de ${MAX_RETRIES}\nErro: ${error}`)
  
        await sleep(5000 * retries)
      }
    } while (retries < MAX_RETRIES)
  
    return []
  }

  protected async saveProducts(products: ProductExtendedBase[], Departamento?: string, Categoria?: string): Promise<void> {
    let productsDatabase
    let duplicados = 0
    
    try {
      productsDatabase = readJson<ProductExtendedBase[]>(this.productsFile)
    } catch {
      productsDatabase = <ProductExtendedBase[]>[]
    }
  
    for (const product of products) {
      if (productsDatabase.findIndex(prod => prod.Id === product.Id && prod.Sku === product.Sku && prod.Link === product.Link) != -1) {
        console.log(`Item duplicado: ${product.Id} ${product.Sku ? product.Sku : product.Link}`.trim())

        duplicados++
      } else {
        const productInfo = { ...product }
        
        if (Departamento) productInfo.Departamento = Departamento
        if (Categoria) productInfo.Categoria = Categoria

        productsDatabase.push(productInfo)
      }
    }

    if (duplicados === products.length) throw Error('Nenhum item encontrado')
  
    writeJson<ProductExtendedBase[]>(this.productsFile, productsDatabase)
  }

  protected async downloadWithZenRows(product: ProductBase): Promise<void> {
    const zenRows = new ZenRows('API_KEY', {
      retries: 10
    })

    try {
      if (!existsPath(this.productsFolder)) makeDirectory(this.productsFolder)

      const fileName = product.Sku ? `${product.Id} ${product.Sku}` : product.Id
      const fullFileName = `${this.productsFolder}/${fileName}.json`
  
      if (!existsPath(fullFileName)) {
        console.log(`iniciando download do produto ${product.Id} (${product.Link})`)

        const { data } = await zenRows.get(product.Link, {
          js_render: true,
          premium_proxy: true,
          autoparse: true,
          antiboot: true
        })
  
        writeJson(fullFileName, data, true)
      }
    } catch (error) {
      console.log(`Erro ao baixar dados: ${error}`)
    }

    console.log('Download finalizado')
  }

  protected async processLink(product: ProductBase): Promise<void> {
    try {
      if (!existsPath(this.productsFolder)) makeDirectory(this.productsFolder)

      const fileName = product.Sku ? `${product.Id} ${product.Sku}` : product.Id
      const fullFileName = `${this.productsFolder}/${fileName}.json`
      const newFullFileName = `${this.productsFolder}_new/${fileName}.html`
  
      if (!existsPath(fullFileName)) {
        const productInfo = await this.getProductInfo(product)
  
        writeJson(fullFileName, productInfo, true)

        for (const fn of this.postProcessingFn) fn(fullFileName)
        
        productToS3(fullFileName, this.bucket)
      }
    } catch {
      console.log('Fim da execução')
    }
  }

  private async getFullPage(product: ProductExtendedBase): Promise<string | null> {
    const { Id, Link } = product
    const browser = await startBrowser()

    console.log(`iniciando download do produto ${Id} (${Link})`)

    try {
      let retries = 1
  
      do {
        try {
          const page = await loadPage(browser, Link)
          
          try {
            return await page.evaluate(async () => {
              return document.body.innerHTML
            })
          } finally {
            await page.close()
          }
        } catch (error) {
          console.log(`Produto ${Link}. Tentativa ${retries++} de ${MAX_RETRIES} não concluída.\nErro: ${error}`)
          
          await sleep(5000 * retries)
        }
      } while (retries <= MAX_RETRIES)
    } catch (error) {
      console.log(`Erro ao processar a página ${Link}: ${error}`)
    } finally {
      await browser.close()
  
      console.log('Download finalizado')
    }

    return null
  }

  private async getProductInfo(product: ProductExtendedBase): Promise<ProductBase> {
    const { Id, Link } = product
    const browser = await startBrowser()

    console.log(`iniciando download do produto ${Id} (${Link})`)

    try {
      let retries = 1
  
      do {
        try {
          const page = await loadPage(browser, Link)
          
          try {
            return {
              ...product,
              ...await this.productDetailsFn!(page, Id)
            }
          } finally {
            page.removeAllListeners()
            await page.close()
          }
        } catch (error) {
          console.log(`Produto ${Link}. Tentativa ${retries++} de ${MAX_RETRIES} não concluída.\nErro: ${error}`)
          
          await sleep(5000 * retries)
        }
      } while (retries <= MAX_RETRIES)
    } catch (error) {
      console.log(`Erro ao processar a página ${Link}: ${error}`)
    } finally {
      browser.removeAllListeners()
      await browser.close()
  
      console.log('Download finalizado')
    }

    return {
      ...product
    }
  }

  protected async downloadImagesOfProduct(file: string, zenRows: boolean): Promise<void> {
    const filePath = `${this.productsFolder}/${file}`
    
    if (existsPath(filePath)) {
      console.log(`Baixando imagens do item ${file}`)
  
      if (!existsPath(this.imagesFolder)) makeDirectory(this.imagesFolder)
      
      const product = readJson<any>(filePath)
      const imageFolder = product.Sku ? `${product.Id}-${product.Sku}`.replaceAll('/', '_') : product.Id
      const fullImageFolder = `${this.imagesFolder}/${imageFolder}`

      if (!existsPath(fullImageFolder)) {
        makeDirectory(fullImageFolder)
  
        await this.getImages(product, fullImageFolder, zenRows)

        imagesToS3(fullImageFolder, this.bucket)
      }
    }
  }
  
  private async getImages(product: any, imageFolder: string, zenRows: boolean): Promise<void> {
    if (product.Imagens && product.Imagens.length > 0) {
      for (const imageUrl of product.Imagens) {
        await this.requestImage(imageUrl, `${imageFolder}/${product.Imagens.indexOf(imageUrl) + 1}.jpg`, zenRows)
      }
    }
  }

  private async requestImage(imageUrl: string, imageFile: string, zenRows: boolean): Promise<void> {
    const requestData: any = zenRows ? {
      url: 'https://api.zenrows.com/v1/',
      method: 'GET',
      params: {
        url: imageUrl.replace('’', "'"),
        apikey: 'e420efdad199eb238c5cee7fd73709b358ab1e7e',
        premium_proxy: true
      },
      responseType: 'stream'
    } : {
      url: imageUrl.replace('’', "'"),
      responseType: 'stream'
    }

    await axios(requestData).then(response => {
      response.data.pipe(createWriteStream(imageFile))
    }).catch(error => {
      console.log(`Erro ao baixar imagem ${imageUrl}: ${error}]`)
    })
  }
}
