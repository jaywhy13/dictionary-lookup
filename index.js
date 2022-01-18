import { Client } from '@notionhq/client';
import axios from 'axios';
import Confirm from 'prompt-confirm';
import 'dotenv/config';

const NOTION_KEY = process.env.NOTION_KEY;
const DATABASE_ID = process.env.DATABASE_ID
const DICTIONARY_APP_ID = process.env.DICTIONARY_APP_ID
const DICTIONARY_APP_KEY = process.env.DICTIONARY_APP_KEY

const client = new Client({ auth: NOTION_KEY });

async function addWord({ word, meanings, examples }) {
    try {

        const response = await client.pages.create({
            parent: {
                database_id: DATABASE_ID,
            },
            properties: {
                Meaning: {
                    type: 'rich_text',
                    rich_text: [{
                        type: 'text',
                        text: {
                            content: meanings.join("\n")
                        },
                        annotations: {}
                    }],
                },
                Examples: {
                    type: 'rich_text',
                    rich_text: [{
                        type: 'text',
                        text: {
                            content: examples.join("\n")
                        },
                        annotations: {}
                    }],
                },
                "Word": {
                    "id": "title",
                    "type": "title",
                    "title": [
                        {
                            "type": "text",
                            "text": {
                                "content": word,
                                "link": null
                            },
                        }
                    ]
                }

            }
        })
    }
    catch (error) {
        console.log(error);
    }
}


async function fetchPage(pageId) {
    const response = await client.pages.retrieve({
        page_id: pageId
    })
    console.log(JSON.stringify(response, null, 4));
    return response;
}


async function getWordDefinition(word) {
    const fields = ['definitions', 'examples']
    const url = 'https://od-api.oxforddictionaries.com//api/v2/entries/en-gb/' + word + '?';
    const response = await axios.get(url, {
        headers: {
            'app_id': DICTIONARY_APP_ID,
            'app_key': DICTIONARY_APP_KEY
        },
        params: {
            fields: fields.join(','),
            strictMatch: false,
        }
    });
    const results = [];
    response.data.results.forEach((result) => {
        result.lexicalEntries.forEach((lexicalEntry) => {
            let lexicalCategory = lexicalEntry.lexicalCategory.id;
            lexicalEntry.entries.forEach((entry) => {
                entry.senses.forEach(sense => {
                    const definitions = sense.definitions;
                    const examples = sense.examples.map(example => example.text);
                    results.push({ wordType: lexicalCategory, definitions, examples })
                })
            })
        })
    })
    return results;
}

const word = process.argv[2];
if (word) {
    console.log("Looking up definition for", word);
    const results = await getWordDefinition(word);
    console.log("Got back definitions:", results);

    let allMeanings = [];
    let allExamples = [];

    results.forEach(({ wordType, definitions, examples }) => {
        definitions.forEach(definition => {
            allMeanings.push(`(${wordType}) ${definition}`)
            examples.forEach(example => allExamples.push(`(${wordType}) ${example}`))
        })
    })

    const formattedWord = {
        word,
        meanings: allMeanings,
        examples: allExamples
    }

    const confirmation = new Confirm('Add to Notion?');
    const addToNotion = await confirmation.run();
    if (addToNotion) {
        console.log("Adding word", formattedWord);
        addWord(formattedWord)
    }
} else {
    console.error('Please enter a word');
}
