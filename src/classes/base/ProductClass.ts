import { BATCH_SIZE } from '../../constants'
import { min, readFolderItems, readJson, sleep } from '../../library'
import { ProductBase } from '../../interfaces'
import { PostProcessing, ProductAncestor, ProductDetails, ProductLinks } from './ProductAncestor'
import { LinkCategory } from '../../types'

export abstract class ProductClass extends ProductAncestor {
  protected assignPostProcessing(postProcessing: PostProcessing[]): void { this.postProcessingFn = postProcessing }
  protected assignProductDetails(productDetails: ProductDetails): void { this.productDetailsFn = productDetails }
  protected assignProductLinks(productLinks: ProductLinks): void { this.productLinksFn = productLinks }

  constructor(folder: string, bucket: string) {
    super(folder, bucket)
  }

  public async downloadProductLinks(categoriesToDownload: LinkCategory[], pageQuery: string = 'page'): Promise<void> {
    if (!this.productLinksFn) throw Error('Função de extração de links não atribuída')

    let productPageList = <ProductBase[]>[]
    
    for (const category of categoriesToDownload) {
      let pages = category.PaginaInicial - 1
      
      try {
        const operator = category.Link.indexOf('?') === -1 ? '?' : '&'

        do {
          productPageList = await this.getProductLinks(`${category.Link}${operator}${pageQuery}=${++pages}`)
  
          await this.saveProducts(productPageList, category.Departamento, category.Categoria)
  
          console.log(`Página ${pages} processada!`)
        } while (productPageList.length > 0)
      } catch (error) {
        console.log(`Erro ocorrido ao processar departamento ${category.Departamento}: ${error}\nUltima página processada: ${pages}`)
      }
    }
  }
  
  public async downloadProductInfo(zenRows: boolean = false): Promise<void> {
    if (!this.productDetailsFn) throw Error('Função de extração de produtos não atribuída')

    try {
      this.products = readJson<ProductBase[]>(this.productsFile)
    } catch {
      throw Error(`Produtos não encontrados no arquivo ${this.productsFile}`)
    }

    const productsLength = this.products.length

    for (let i = 0; i < productsLength; i += BATCH_SIZE) {
      console.time('Tempo decorrido')

      const productsToProcess = this.products.slice(i, i + BATCH_SIZE)
      const process = productsToProcess.map(async prod => zenRows ? await this.downloadWithZenRows(prod) : await this.processLink(prod))
      
      await Promise.all(process)

      console.timeEnd('Tempo decorrido')
      console.log(`Arquivos processados: ${min(i + BATCH_SIZE, productsLength)}/${productsLength}`)

      await sleep(1)
    }
  }

  public async downloadImages(zenRows: boolean = false): Promise<void> {
    const productFiles = readFolderItems(this.productsFolder)

    for (let i = 0; i < productFiles.length; i += BATCH_SIZE) {
      console.time('Tempo decorrido')
  
      const filesToProcess = productFiles.slice(i, i + BATCH_SIZE)
      const process = filesToProcess.map(async file => await this.downloadImagesOfProduct(file, zenRows))
      
      await Promise.all(process)
  
      console.timeEnd('Tempo decorrido')
      console.log(`Download finalizado: ${min(i + BATCH_SIZE, productFiles.length)}/${productFiles.length}`)
  
      await sleep(1)
    }
  }
}
