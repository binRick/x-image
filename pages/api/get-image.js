import puppeteer from 'puppeteer'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
const fs = require('fs');
const path = require('path');
var DEBUG_MODE = false;


export default async (req, res) => {
  try {
    const { xUrl, width, theme, padding, hideCard, hideThread, reqtype } = req.body

   if(DEBUG_MODE)
      console.log(`\n #### `, reqtype, `####`);

    const lang = 'en'
    const splitUrl = xUrl.split('/')
    const lastItem = splitUrl[splitUrl.length - 1]
    const splitLastItem = lastItem.split('?')
    const xPostId = splitLastItem[0]
    var extracted_images_qty = 0;
    var largest_image = null;

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
	  if(DEBUG_MODE){
	    console.log(`>>>   [IMAGE]`);
	    console.log(`>>>      [`, url, `]`);
	  }
          response.buffer().then(file => {
		extracted_images_qty++;
		if(!largest_image || largest_image.data.length < file.length){
			largest_image = {
			  'url': url,
			  'data': file.valueOf(),
			};
		}
          });
        }
    });
    const turl = `https://platform.twitter.com/embed/index.html?dnt=true&embedId=twitter-widget-0&frame=false&hideCard=${hideCard}&hideThread=${hideThread}&id=${xPostId}&lang=${lang}&theme=${theme}&widgetsVersion=ed20a2b%3A1601588405575`;
    console.log(`X URL>   `, turl);
    await page.goto(turl, { waitUntil: 'networkidle2'});

    const embedDefaultWidth = 550
    const percent = width / embedDefaultWidth
    const pageWidth = embedDefaultWidth * percent
    const pageHeight = 500
    await page.setViewport({ width: pageWidth, height: pageHeight })


    const eval_res = await page.evaluate(
      (props) => {

        const { theme, padding, percent } = props

        const style = document.createElement('style')
        style.innerHTML =
          "* { font-family: -apple-system, BlinkMacSystemFont, Ubuntu, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol' !important; }"
        document.getElementsByTagName('head')[0].appendChild(style)

        //const body = document.querySelector('body')

	console.log('Acquiring images....')

/*

      const srcs = Array.from(
        document.querySelectorAll("img")
      ).map((image) => image.getAttribute("src"));
    console.log(`Evaluating Page....`, srcs.length, ` Images found`);
*/
        //const imgs = document.getElementsByTagName('img')
	//console.log(JSON.stringify(imgs));
	//console.log(`Got `. imgs.length, ` images`);
        const body = document.querySelector('body')
        if (body) {
          body.style.padding = `${padding}px`
          body.style.backgroundColor = theme === 'dark' ? '#000' : '#fff'
          body.style.zoom = `${100 * percent}%`
        }
//	if(largest_image)
//	        return Promise.resolve(largest_image);

      },
      { theme, padding, percent }
    );
    console.log(`Evaluated Page`);
//    console.log(`    result: `, JSON.stringify(eval_res));
    if(!largest_image){
    	console.log(`***  Failed to identify image ***`);
    }else{
    	console.log(`!-!-!    `, largest_image.data.length, `B Image Extracted from `, extracted_images_qty,` Images! !-!-!`);
	var filePath = `wow.jpeg`;
                const writeStream = fs.createWriteStream(filePath);
                writeStream.write(largest_image.data);
	console.log(`Wrote => `, filePath);
    }
    var imageBuffer = null;
    var res_sent = false;

    if(reqtype == 'full'){
     console.log('[FULL IMAGE]');
     imageBuffer = await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'base64'
     })
    }else if(reqtype == 'largest_image'){
     console.log('[LARGEST IMAGE]');
     if(!largest_image){
	console.log(`  Returning overall tweet`);
        imageBuffer = await page.screenshot({
          type: 'png',
          fullPage: true,
          encoding: 'base64'
        })
    }else{
	console.log(`  Returning Largest Image`);
	console.log(`  `, largest_image.url);
	largest_image.url_png = largest_image.url.replace(`format=jpg`,`format=png`);
	console.log(`  [PNG]> `, largest_image.url_png);
    	await page.goto(largest_image.url_png, { waitUntil: 'networkidle2'});
	const buf = await page.goto(largest_image.url_png, { waitUntil: 'networkidle0' }).then(res => res.buffer());
	console.log(`  [PNG]  `, buf.length, `B`);
	imageBuffer = await page.screenshot({
		type: 'png',
		fullPage: true,
		encoding: 'base64'
	})

	//imageBuffer = btoa(unescape(encodeURIComponent(largest_image_object)));
	//var filePath = `wow1.jpeg`;
        //const writeStream = fs.createWriteStream(filePath);
        //writeStream.write(largest_image.data);

	//	res.sendFile(filePath);

	//const i = fs.readFileSync(filePath)
	//const i1 = btoa(largest_image.data);
	//imageBuffer = btoa(unescape(encodeURIComponent(largest_image_object)));

	//       res.setHeader('Content-Type', 'image/jpg')
	//     res.send(i)

	//res_sent = true;

     }
/*
     imageBuffer = await page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'base64'
     })
*/

    }else{
	console.log('###ERROR UNHANLDED REQUEST TYPE: ', reqtype);
    }

    if (process.env.VERCEL_ENV !== 'production') {
      await browser.close()
    }

    if(!res_sent)
      res.json({ data: imageBuffer })
  } catch (err) {
    console.log(err)
    res.json({ error: err.message })
  }
}
