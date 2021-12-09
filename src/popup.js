// https://www.npmjs.com/package/wink-bm25-text-search
let bm25 = require('wink-bm25-text-search')
let engine = bm25()
const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');
const nlp = winkNLP(model);
const its = nlp.its;

const prepTask = function ( text ) {
    const tokens = [];
    nlp.readDoc(text)
        .tokens()
        // Use only words ignoring punctuations etc and from them remove stop words
        .filter( (t) => ( t.out(its.type) === 'word' && !t.out(its.stopWordFlag) ) )
        // Handle negation and extract stem of the word
        .each( (t) => tokens.push( (t.out(its.negationFlag)) ? '!' + t.out(its.stem) : t.out(its.stem) ) );
    return tokens;
};

engine.defineConfig( { fldWeights: { content: 1 } } );

engine.definePrepTasks( [ prepTask ] );

let docsNotAdded = true;
let queryInput = document.getElementById('searchInput')

document.getElementById("searchButton").addEventListener("click", handleSearch)

async function handleSearch() {
    if (queryInput.value && queryInput.value.length < 1) {
        // No need to do anything
        return;
    }

    // Get current tab
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Execute the function that will retrieve the page's text and store it in the browser
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: storePageVisibleText
    });

    console.log("Getting Page Content")
    chrome.storage.local.get("content", retrieveAndProcessPageText)
}

async function storePageVisibleText() {
    // https://stackoverflow.com/a/48001585
    function getVisibleText(element) {
        window.getSelection().removeAllRanges();
        
        let range = document.createRange();
        range.selectNode(element);
        window.getSelection().addRange(range);
        
        let visibleText = window.getSelection().toString().trim();
        window.getSelection().removeAllRanges();
        
        return visibleText;
    }

    let content = getVisibleText(document.body)
    console.log("Storing page content")
    // Store all visible text in a JSON object that looks like {content: "Visible page text..."}
    await chrome.storage.local.set({ content });
}

function retrieveAndProcessPageText(result) {
    let resultList = document.getElementById("resultsList");
    // clear previous results
    resultList.innerHTML = '';
    if (!result.content || result.content.length < 1) {
        return
    }
    // Turn each word into a document
    let docs = result.content.split(' ').map((str) => ({ content: str }))
    if (docsNotAdded) {
        docs.forEach((doc, idx) => {
            engine.addDoc(doc, idx)
        });
        engine.consolidate();
        docsNotAdded = false;
    }

    let results = engine.search(queryInput.value)
    console.log(results)
    results.forEach((result) => {
        let listItem = document.createElement("li");
        listItem.innerText = docs[result[0]].content
        resultList.appendChild(listItem)
    })
    if (results.length < 1) {
        resultList.innerText = '-- no results --'
    }
}