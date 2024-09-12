const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const Web3 = require('web3');  // Verifique que o Web3 está corretamente importado

// Corrigido: Instanciar o Web3 com o provedor da BSC
const web3 = new Web3('https://bsc-dataseed.binance.org/');

// Caminho para o arquivo wallets.json
const walletsFile = path.join(__dirname, 'wallets.json');

// Função para carregar as carteiras do arquivo
function loadWallets() {
    if (fs.existsSync(walletsFile)) {
        const data = fs.readFileSync(walletsFile);
        return JSON.parse(data);
    }
    return {};
}

// Função para salvar as carteiras no arquivo
function saveWallets(wallets) {
    fs.writeFileSync(walletsFile, JSON.stringify(wallets, null, 4));
}

// Função para gerar uma nova carteira usando Web3
function generateWallet() {
    const account = web3.eth.accounts.create();
    return {
        publicAddress: account.address,
        privateKey: account.privateKey,
    };
}

// Função para calcular o tempo restante até a restauração da energia
function getTimeUntilEnergyRestore(lastUse) {
    if (lastUse) {
        const lastUseTime = new Date(lastUse);
        const now = new Date();
        const secondsPassed = (now - lastUseTime) / 1000;
        if (secondsPassed >= 60) {
            return 0; // Energia pronta para restaurar
        }
        return Math.floor(60 - secondsPassed); // Segundos restantes para restaurar energia
    }
    return 0;
}

// Função para verificar e restaurar energia
function restoreEnergy(userId) {
    const wallets = loadWallets();
    const userData = wallets[userId];

    if (userData) {
        const lastUse = userData.lastEnergyUse;
        let energy = userData.energy || 60;
        let secondsUntilRestore = getTimeUntilEnergyRestore(lastUse);

        if (lastUse) {
            const lastUseTime = new Date(lastUse);
            const now = new Date();
            const minutesPassed = Math.floor((now - lastUseTime) / (1000 * 60));

            // Restaurar energia proporcional ao tempo passado (1 energia por minuto)
            if (minutesPassed >= 1 && energy < 60) {
                const energyToRestore = Math.min(60 - energy, minutesPassed);
                energy += energyToRestore;
                userData.energy = energy;
                userData.lastEnergyUse = new Date().toISOString();
                saveWallets(wallets);
            }
        }

        // Recalcular o tempo restante para restaurar energia
        secondsUntilRestore = getTimeUntilEnergyRestore(userData.lastEnergyUse);
        return { energy: userData.energy, secondsUntilRestore };
    }
    return { energy: 60, secondsUntilRestore: 0 };
}

// Função para inicializar o usuário e criar uma carteira se necessário
function initializeUser(userId) {
    const wallets = loadWallets();
    if (!wallets[userId]) {
        const { publicAddress, privateKey } = generateWallet();
        wallets[userId] = {
            balance: 0,
            energy: 60,
            lastEnergyUse: null,
            publicAddress,
            privateKey,
        };
        saveWallets(wallets);
    }
}

// Configuração do bot com polling
const token = process.env.BOT_TOKEN || '7443823659:AAFMhsKID1ffdjBZSzeGNu-Mr0RbQ-EVOVQ';
const bot = new TelegramBot(token, { polling: true });

// Comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    initializeUser(userId);

    const wallets = loadWallets();
    const userData = wallets[userId];
    const { energy, secondsUntilRestore } = restoreEnergy(userId);

    if (!userData) {
        bot.sendMessage(chatId, "Erro ao carregar os dados do usuário.");
        return;
    }

    // Gerar o link do jogo com o user_id incluído
    const gameLink = `https://cashhand.info/cashhand/cashhandapp/?user_id=${userId}`;

    // Cria o botão de Web App que abrirá o jogo dentro do Telegram
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Start Game', web_app: { url: gameLink } }],
            ],
        },
    };

    // Envia a mensagem com o botão de Web App e informações da carteira
    bot.sendMessage(chatId, `Bem-vindo ao CashHand Game!\nSua energia: ${energy}/60\nTempo até a próxima restauração: ${secondsUntilRestore}s\nClique no botão abaixo para iniciar o jogo.`, options);
});

// Função para monitorar erros no bot
bot.on('polling_error', (error) => {
    console.error(`Erro no bot: ${error.code}`, error.message);
});
