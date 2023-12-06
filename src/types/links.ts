import { ProductExtendedBase } from '../interfaces'

export type LinkCategory = {
  Link: string
  PaginaInicial: number
} & Pick<ProductExtendedBase, 'Departamento' | 'Categoria'>
