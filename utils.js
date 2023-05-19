const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

let postsPages = [];
let counter = 0;
let pageCounter = 0;


(async () => {
    for (let i = 0; i < 10; i++) {
        await getPagePosts(++pageCounter);
    }

    for (let postPage of postsPages) {
        await generatePDF(postPage);
    }
})()

async function generatePDF(postPageURLs) {
    const home = process.cwd();
    const dest = path.join(home, 'backups', `page_${++counter}`);
    let post_counter = 0;
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        for (let url of postPageURLs) {
            console.log('Generating media for post: ', ++post_counter);

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36');

            await page.goto(url, { waitUntil: 'networkidle0' });
            await page.setViewport({ width: 1200, height: 1080 });
            page.on('dialog', async (dialog) => {
                console.log('Dialog message:', dialog.message());
                await dialog.accept();
            });

            const pageTitle = await page.title();

            const outputPath = path.join(dest, `${post_counter}_${pageTitle}.pdf`);
            // console.log('outputPath', outputPath);

            const scrollHeight = await page.evaluate(() => {
                return document.body.scrollHeight;
            })

            await page.evaluate(async (scrollHeight) => {

                /**
                 * Start: iframe for codepen conversion to simple redirect links to codepen
                 */
                const iframes = Array.from(document.querySelectorAll('iframe.cp_embed_iframe'));
                const iframeWrappers = Array.from(document.querySelectorAll('.cp_embed_wrapper'));
                let codePenLinkNode = document.createElement('a');
                codePenLinkNode.textContent = 'Visit Codepen';
                for (let iframeIndex = 0; iframeIndex < iframeWrappers.length; iframeIndex++) {
                    const iframeWrapper = iframeWrappers[iframeIndex];
                    iframes[iframeIndex].remove();
                    const clone = codePenLinkNode.cloneNode(true);
                    clone.setAttribute('href', iframes[iframeIndex].src);
                    iframeWrapper.appendChild(clone);
                }
                /**
                 * End: iframe for codepen conversion to simple redirect links to codepen
                 */


                /**
                 * Expand pre tag code snippets
                 */
                const preTags = document.querySelectorAll('pre');
                preTags.forEach(preTag => {
                    preTag.style.whiteSpace = 'pre-wrap';
                    preTag.style.height = 'fit-content';
                    preTag.style.maxHeight = preTag.style.height;
                })


                /**
                 * check if footer is in view
                 */
                const footer = document.querySelector('footer');
                function isElementInView(element) {
                    const rect = element.getBoundingClientRect();
                    const windowHeight =
                        window.innerHeight || document.documentElement.clientHeight;
                    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

                    // Check if any part of the element is within the viewport
                    const isElementInView =
                        rect.top <= windowHeight &&
                        rect.bottom >= 0 &&
                        rect.left <= windowWidth &&
                        rect.right >= 0;

                    return isElementInView;
                }

                /**
                * Scrolling by 300px till page end is reached
                */
                let scrollingPixels = 300;
                let scrollingCounter = 0;

                while (scrollingPixels < scrollHeight) {
                    window.scrollBy(0, 300);
                    scrollingPixels = scrollingPixels + 300;
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    console.log('Scrolling...', ++scrollingCounter);
                    if (isElementInView(footer)) {
                        break;
                    }
                }
            }, scrollHeight)


            await page.pdf({
                path: outputPath,
                format: 'A4',
            });
            console.log('Saved media');
            await page.close();
        }
    } catch (error) {
        console.log('Error while media generation:', error.message);
    }
    await browser.close();
}



async function getPagePosts(pageNo) {
    console.log('Accumulating post urls for page:', pageNo);
    const url = `https://blog.logrocket.com/page/${pageNo}/`
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36');

        await page.goto(url);
        await page.setViewport({ width: 1920, height: 1080 });

        const postsURLs = await page.evaluate(() => {
            const posts = Array.from(document.querySelectorAll('.container .card'));
            return posts.map(post => {
                return post.querySelector('.card-title > a').href;
            })
        });

        postsPages.push(postsURLs);
    } catch (error) {
        console.log('Error inside getPagePosts', error.message);
    }
    await browser.close();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
