const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const AUTHORIZED_CHAT_ID = process.env.AUTHORIZED_CHAT_ID;

let LAST_PROCESSED_UPDATE_ID = 0;

app.post('/', async (req, res) => {
    try {
        console.log("doPost called with event: " + JSON.stringify(req.body));
        
        const contents = req.body;

        if (contents.update_id <= LAST_PROCESSED_UPDATE_ID) {
            console.log("Update ya procesado, ignorando: " + contents.update_id);
            return res.send("Already processed update.");
        }

        LAST_PROCESSED_UPDATE_ID = contents.update_id;

        const chatId = contents.message.chat.id;
        const text = contents.message.text;

        if (chatId.toString() !== AUTHORIZED_CHAT_ID) {
            console.log("Chat no autorizado: " + chatId);
            return res.send("Unauthorized chat.");
        }

        const notionResponse = await sendToNotion(text);

        if (notionResponse.object !== 'error') {
            await sendTelegramMessage(chatId, "Mensaje enviado exitosamente a Notion.");
        } else {
            await sendTelegramMessage(chatId, "Hubo un problema al enviar el mensaje a Notion. Por favor, intenta de nuevo más tarde.");
        }

        res.send("OK");
    } catch (error) {
        console.log("Error: " + error.message);
        res.status(500).send("Error: " + error.message);
    }
});

async function sendTelegramMessage(chatId, message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const payload = {
        chat_id: chatId,
        text: message
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log("Telegram response: " + JSON.stringify(data));
    } catch (error) {
        console.log("Error al enviar mensaje a Telegram: " + error.message);
    }
}

async function sendToNotion(text) {
    if (!text) {
        console.log("Error: El texto a enviar a Notion está vacío.");
        return { object: 'error', message: 'El texto a enviar a Notion está vacío.' };
    }

    const url = 'https://api.notion.com/v1/pages';
    const payload = {
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
            Name: {
                title: [
                    {
                        text: {
                            content: text
                        }
                    }
                ]
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2021-08-16'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log("Notion response content: " + JSON.stringify(data));
        return data;
    } catch (error) {
        console.log("Error al enviar datos a Notion: " + error.message);
        return { object: 'error', message: error.message };
    }
}

app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running...');
});