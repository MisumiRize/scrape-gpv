import moment from 'moment'
import path from 'path'
import puppeteer from 'puppeteer'

moment.locale('ja')
const LABEL_FORMAT = 'MM/DD(ddd) HH:00'

export default async (date: string | number, hour?: number): Promise<string> => {
  let label: string
  if (date === 'today' && hour != null) {
    label = moment().set('hour', hour).format(LABEL_FORMAT)
  } else if (date === 'tomorrow' && hour != null) {
    label = moment().add(1, 'day').set('hour', hour).format(LABEL_FORMAT)
  } else if (typeof date === 'number') {
    label = moment().set('hour', date).format(LABEL_FORMAT)
  } else if (typeof date === 'string' && /^[0-9]{1,2}-[0-9]{1,2}$/.test(date) && hour != null) {
    const datetime = `${moment().get('year')}-${date} ${hour}:00:00`
    const target = moment(datetime)
    if (!target.isValid()) {
      throw new Error(`Invalid datetime: ${datetime}`)
    }
    label = target.format(LABEL_FORMAT)
  } else {
    throw new Error(`I can't understand date: ${date}, hour: ${hour}`)
  }

  const browser = await puppeteer.launch(
    process.env.CI || process.env.DYNO
      ? { args: [ '--no-sandbox', '--disable-setuid-sandbox' ] }
      : {}
  )
  let page: puppeteer.Page | undefined
  try {
    page = await browser.newPage()

    await page.goto('http://weather-gpv.info', { waitUntil: 'networkidle2' })
    await page.frames()[1].click('#sd_cp_l')
    const mainFrame = page.frames()[4]
    await mainFrame.waitFor('option[value="0"]', { timeout: '5000' })

    const fnl: any = await mainFrame.evaluate((): any => {
      const w: any = window
      return w.fnl
    })
    if (!Array.isArray(fnl)) {
      throw new Error(`Error fnl is invalid: ${fnl}`)
    }
    const files: string[] = fnl.filter(item => typeof item === 'string')

    const value: string | null = await mainFrame.evaluate((label: string): string | null => {
      const option: HTMLOptionElement | undefined = Array.prototype.find.call(
        document.querySelectorAll('option'),
        (el: HTMLOptionElement) => el.textContent === label
      )
      return option == null ? null : option.value
    }, label)
    if (value == null) {
      throw new Error(`No option found for label: ${label}`)
    }
    const filename = files[parseInt(value, 10)]
    if (filename == null) {
      throw new Error(`No such filename for label: ${label}`)
    }

    // @ts-ignore
    await mainFrame.select('select[name="dt"]', value)
    await mainFrame.waitFor((filename: string): boolean => {
      const image = document.querySelector<HTMLImageElement>('img[name="wIMG"]')
      if (image == null) {
        return false
      }
      return image.src.includes(filename)
    }, { timeout: 10000 }, path.basename(filename))

    const location: string | null = await mainFrame.evaluate((): string | null => {
      const image = document.querySelector<HTMLImageElement>('img[name="wIMG"]')
      if (image == null) {
        return null
      }
      return image.src
    })
    if (location == null) {
      throw new Error('Image not found')
    }
    return location
  } catch (e) {
    throw e
  } finally {
    if (page != null) {
      await page.close()
    }
    await browser.close()
  }
}
