export interface ProductBase {
  Id: string
  Sku?: string
  Link: string
}

export interface ProductExtendedBase extends ProductBase {
  Nome?: string
  Cor?: string | string[]
  Preco?: number
  Departamento?: string
  Categoria?: string
  Descricao?: string
  Imagens?: string[]
}
