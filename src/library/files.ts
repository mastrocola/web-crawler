import fs from 'fs'

export const existsPath = (path: string): boolean => {
  return fs.existsSync(path)
}

export const makeDirectory = (path: string): void => {
  fs.mkdirSync(path)
}

export const moveFile = (src: string, dest: string): void => {
  fs.copyFileSync(src, dest)
  fs.rmSync(src)
}

export const readFile = <T>(file: string): T => {
  return fs.readFileSync(file) as T
}

export const readFolderItems = (folder: string): string[] => {
  return fs.readdirSync(folder) 
}

export const readJson = <T>(jsonFile: string): T => {
  return JSON.parse(fs.readFileSync(jsonFile, 'utf-8')) as T
}

export const removeDirectory = (path: string): void => {
  fs.rmSync(path, { recursive: true, force: true })
}

export const writeFile = (file: string, data: string): void => {
  return fs.writeFileSync(file, data)
}

export const writeJson = <T>(jsonFile: string, data: T, toAthena: boolean = false): void => {
  return fs.writeFileSync(jsonFile, JSON.stringify(data, null, toAthena ? 0 : 2))
}

export const createWriteStream = (fileName: string): fs.WriteStream => {
  return fs.createWriteStream(fileName)
}
