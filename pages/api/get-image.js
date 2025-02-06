import puppeteer from 'puppeteer'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
const fs = require('fs');
const path = require('path');


export default async (req, res) => {
  try {
    const { xUrl, width, theme, padding, hideCard, hideThread } = req.body

    const lang = 'en'
    const splitUrl = xUrl.split('/')
    const lastItem = splitUrl[splitUrl.length - 1]
    const splitLastItem = lastItem.split('?')
    const xPostId = splitLastItem[0]

    let browser
    if (process.env.VERCEL_ENV === 'production') {
      const executablePath = await chromium.executablePath()
      browser = await puppeteerCore.launch({
        executablePath,
        args: chromium.args,
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport
      })
    } else {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }

    const page = await browser.newPage()
    var largest_image_objects = null;
    var extracted_images_qty = 0;
    page.on('console', async (msg) => {
	  const msgArgs = msg.args();
	  for (let i = 0; i < msgArgs.length; ++i) {
	    console.log(await msgArgs[i].jsonValue());
	  }
    });
    page.on('response', async response => {
        const url = response.url();
	//console.log(`>>>   [`, url, `]`);
        if (response.request().resourceType() === 'image') {
		console.log(`>>>   [IMAGE]`);
		console.log(`>>>      [`, url, `]`);
		//extracted_images_qty++;
            response.buffer().then(file => {
                const fileName = url.split('/').pop();
                const filePath = path.resolve(__dirname, fileName);
		console.log(`>>>      Writing `, file.length, `B file [`, filePath, `]`);
//		if(!largest_image_object || largest_image_object.length < file.length){
//			largest_image_object = file;
//		}

        //        const writeStream = fs.createWriteStream(filePath);
         //       writeStream.write(file);
            });
        }
    });
    await page.goto(`https://platform.twitter.com/embed/index.html?dnt=true&embedId=twitter-widget-0&frame=false&hideCard=${hideCard}&hideThread=${hideThread}&id=${xPostId}&lang=${lang}&theme=${theme}&widgetsVersion=ed20a2b%3A1601588405575`, { waitUntil: 'networkidle2' })
    console.log(`https://platform.twitter.com/embed/index.html?dnt=true&embedId=twitter-widget-0&frame=false&hideCard=${hideCard}&hideThread=${hideThread}&id=${xPostId}&lang=${lang}&theme=${theme}&widgetsVersion=ed20a2b%3A1601588405575`)

    const embedDefaultWidth = 550
    const percent = width / embedDefaultWidth
    const pageWidth = embedDefaultWidth * percent
    const pageHeight = 2000
    await page.setViewport({ width: pageWidth, height: pageHeight })


    await page.evaluate(
      (props) => {

        const { theme, padding, percent } = props

        const style = document.createElement('style')
        style.innerHTML =
          "* { font-family: -apple-system, BlinkMacSystemFont, Ubuntu, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol' !important; }"
        document.getElementsByTagName('head')[0].appendChild(style)

        //const body = document.querySelector('body')

	console.log('Acquiring images....')



      const srcs = Array.from(
        document.querySelectorAll("img")
      ).map((image) => image.getAttribute("src"));
    console.log(`Evaluating Page....`, srcs.length, ` Images found`);

        //const imgs = document.getElementsByTagName('img')
	//console.log(JSON.stringify(imgs));
	//console.log(`Got `. imgs.length, ` images`);
        const body = document.querySelector('body')
        if (body) {
          body.style.padding = `${padding}px`
          body.style.backgroundColor = theme === 'dark' ? '#000' : '#fff'
          body.style.zoom = `${100 * percent}%`
        }
      },
      { theme, padding, percent }
    );
    console.log(`Evaluated Page`);
/*
    if(!largest_image_object){
    	console.log(`***  Failed to identify image ***`);
    }else{
    	console.log(`!-!-!    `, largest_image_object.length, `B Image Extracted from `, extracted_images_qty,` Images! !-!-!`);
    }
*/

    const imageBuffer = await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'base64'
    })

    if (process.env.VERCEL_ENV !== 'production') {
      await browser.close()
    }

    res.json({ data: imageBuffer })
  } catch (err) {
    console.log(err)
    res.json({ error: err.message })
  }
}
