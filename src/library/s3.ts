import { basename } from 'path'
import { readFile, readFolderItems } from '.'
import { S3 } from 'aws-sdk'

export const imagesToS3 = (imageFolder: string, bucketName: string): void => {
  const arquivos = readFolderItems(imageFolder)  

  for (const arquivo of arquivos) {
    uploadToS3(bucketName, `imagens/${basename(imageFolder)}/${arquivo}`, readFile(`${imageFolder}/${arquivo}`))
  }
}

export const productToS3 = (productFile: string, bucketName: string): void => {
  const fileName = basename(productFile)

  uploadToS3(bucketName, `produtos/${fileName}`, readFile(productFile))
}

const uploadToS3 = (Bucket: string, Key: string, Body: string): void => {
  const s3 = new S3()

  s3.upload({ Bucket, Key, Body }, (err, _) => {
    if (err) {
      console.log(`Erro: ${err}`)
    } else {
      console.log(`Arquivo enviado: ${Key}`)
    }
  })
}
