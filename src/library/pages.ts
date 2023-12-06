import { Browser, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import * as userAgent from 'puppeteer-extra-plugin-anonymize-ua'

export { Page } from 'puppeteer'

export const scrollToEnd = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    let cursor = 0
    
    while (cursor < document.body.scrollHeight) {
      window.scrollTo(0, cursor < document.body.scrollHeight ? cursor : document.body.scrollHeight)

      await new Promise(r => window.setTimeout(r, 100))
      cursor += 500
    }
  })

  await new Promise(r => setTimeout(r, 2000))
}

export const loadPage = async (browser: Browser, url: string): Promise<Page> => {
  const page = await browser.newPage()

  await page.goto(url, { waitUntil: 'networkidle2' })

  page.on('console', async (msg) => {
    const msgArgs = msg.args()

    for (let i = 0; i < msgArgs.length; ++i) {
      console.log(await msgArgs[i].jsonValue())
    }
  })

  return page
}

export const startBrowser = async (): Promise<Browser> => {
  const stealthPlugin = StealthPlugin()

  stealthPlugin.enabledEvasions.delete('chrome.runtime')
  stealthPlugin.enabledEvasions.delete('iframe.contentWindow')

  puppeteer.use(stealthPlugin)
  puppeteer.use(AdblockerPlugin({ blockTrackersAndAnnoyances: true }))
  puppeteer.use(userAgent.default({
    customFn: _ => {
      return 'Mozilla/5.0 (Windows NT 10.0 Win64 x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36'
    }
  }))

  return puppeteer.launch({
    headless: 'new',
    devtools: false,
    ignoreHTTPSErrors: true,
    defaultViewport: null,    
    args: [
      '--no-zygote',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-blink-features',
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-infobars',
      '--disable-notifications',
      '--disable-desktop-notifications',
      '--hide-scrollbars',
      '--mute-audio',
      '--window-position=0,0',
      '--window-size=1920,1080',
      '--font-render-hinting=none',
      '--disable-gpu',
      '--disable-gpu-sandbox',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--enable-low-res-tiling',
      '--disable-accelerated-2d-canvas',
      '--disable-canvas-aa',
      '--disable-2d-canvas-clip-aa',
      '--disable-gl-drawing-for-tests',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--disable-webgl',
      '--disable-webgl2',
      '--disable-gpu-compositing'
    ],
    ignoreDefaultArgs: [
      '--enable-automation'
    ]
  })
}
