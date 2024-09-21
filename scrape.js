const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const cityCoordinates = {
    'uae': {
        'dubai': { latitude: 25.276987, longitude: 55.296249 },
        'abu dhabi': { latitude: 24.453884, longitude: 54.377344 },
        'sharjah': { latitude: 25.346255, longitude: 55.421100 },
    },
    'saudi arabia': {
        'riyadh': { latitude: 24.7136, longitude: 46.6753 },
        'jeddah': { latitude: 21.2854, longitude: 39.2376 },
        'damman': { latitude: 26.4201, longitude: 50.0888 },
    }
};

async function extractData(keyword, page, city, country) {
    let result = `\nResults for keyword: ${keyword} in ${city}\n`;

    const countryParams = country === 'uae' ? 'gl=ae&hl=en' : 'gl=sa&hl=en';
    await page.goto(`https://www.google.com/search?q=${keyword}&${countryParams}`, { waitUntil: 'networkidle2', timeout: 60000 });

    result += '\nPeople Also Ask:\n';
    try {
        const peopleAlsoAsk = await page.$$eval('.related-question-pair', elements =>
            elements.map(el => el.innerText)
        );
        result += peopleAlsoAsk.join('\n') + '\n';
    } catch (error) {
        result += 'No results for "People Also Ask"\n';
    }


    result += '\nPeople Also Search For:\n';
    try {
        const relatedSearches = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('div.B2VR9.CJHX3e'));
            return elements.map(el => el.innerText).filter(text => text.trim() !== '' && !text.includes('...'));
        });
        result += relatedSearches.join('\n') + '\n';
    } catch (error) {
        result += 'No results for "People Also Search For"\n';
    }
    

    return result;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    rl.question('Enter country (UAE or Saudi Arabia): ', async (country) => {
        const countryKey = country.toLowerCase();
        if (!cityCoordinates[countryKey]) {
            console.log('Country not supported. Please use one of the supported countries (UAE or Saudi Arabia).');
            rl.close();
            return;
        }

        rl.question('Enter city: ', async (city) => {
            const cityCoords = cityCoordinates[countryKey][city.toLowerCase()];

            if (!cityCoords) {
                console.log('City not supported. Please use one of the supported cities.');
                rl.close();
                return;
            }

            console.log(`Geolocation coordinates for city ${city}: `, cityCoords);

            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();

            await page.setGeolocation(cityCoords);
            await page.setViewport({ width: 1280, height: 800 });
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9'
            });

            rl.question('Enter keywords separated by commas: ', async (keywordsInput) => {
                const keywords = keywordsInput.split(',').map(keyword => keyword.trim());
                let finalResult = '';

                for (const keyword of keywords) {
                    const data = await extractData(keyword, page, city, countryKey);
                    finalResult += data;

                    await delay(Math.random() * 2000 + 1000);
                }

                fs.writeFileSync('search_results.txt', finalResult, 'utf8');
                console.log(`Results extracted and saved in search_results.txt for city ${city} in ${country}`);

                await browser.close();
                rl.close();
            });
        });
    });
})();
