import { Page } from 'puppeteer'
import { ProductBase } from '.'

export interface ICrawler {
  productDetails: (page: Page, Id?: string)  => Promise<any>
  productLinks: (page: Page)  => Promise<ProductBase[]>
}
