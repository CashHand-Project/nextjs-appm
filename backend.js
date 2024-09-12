const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = 3000;

// Middleware para processar JSON
app.use(express.json());
app.use(cors());

// Caminho para o arquivo JSON que armazenará os dados dos usuários
const walletsFile = path.join(__dirname, 'wallets.json');

// Função para carregar os dados dos usuários
function loadWallets() {
    if (fs.existsSync(walletsFile)) {
        const data = fs.readFileSync(walletsFile);
        const wallets = JSON.parse(data);
        console.log("Dados carregados de wallets.json:", wallets);
        return wallets;
    }
    return {};
}

// Função para salvar os dados dos usuários
function saveWallets(wallets) {
    fs.writeFileSync(walletsFile, JSON.stringify(wallets, null, 4));
}

// Função para gerar uma nova wallet para o usuário
function generateWallet() {
    const public_address = "0x" + uuidv4().replace(/-/g, '').slice(0, 40); // Endereço simulado
    const private_key = uuidv4().replace(/-/g, ''); // Chave privada simulada
    return { public_address, private_key };
}

// Função para inicializar um novo usuário com uma wallet
function initializeUser(userId) {
    const wallets = loadWallets();

    // Garantir que o userId seja tratado como string
    const userIdStr = String(userId);

    if (!wallets[userIdStr]) {
        console.log(`Criando nova wallet para o usuário: ${userIdStr}`);
        const newWallet = generateWallet();
        wallets[userIdStr] = {
            balance: 0,  // Saldo inicial
            energy: 60,  // Energia inicial
            lastEnergyUse: null,
            public_address: newWallet.public_address,  // Novo endereço público
            private_key: newWallet.private_key         // Nova chave privada
        };
        saveWallets(wallets);
    }
    return wallets[userIdStr];
}

// Função para restaurar energia do usuário
function restoreEnergy(userId) {
    const wallets = loadWallets();

    // Garantir que o userId seja tratado como string
    const userIdStr = String(userId);

    const user = wallets[userIdStr];

    if (user) {
        const now = new Date();
        const lastEnergyUse = new Date(user.lastEnergyUse || now);
        const minutesPassed = Math.floor((now - lastEnergyUse) / (1000 * 60));

        // Restaurar apenas 1 ponto de energia por minuto
        if (minutesPassed >= 1 && user.energy < 60) {
            const energyToRestore = Math.min(minutesPassed, 60 - user.energy); // Restaurar 1 ponto de energia por minuto
            user.energy += energyToRestore;
            user.lastEnergyUse = now.toISOString(); // Atualizar o último uso de energia para agora
            saveWallets(wallets);
        }

        const secondsUntilRestore = 60 - (Math.floor((now - new Date(user.lastEnergyUse)) / 1000) % 60);
        return { energy: user.energy, secondsUntilRestore };
    }
    return { energy: 60, secondsUntilRestore: 0 };
}

// Rota para obter dados do usuário
app.post('/get_user_data', (req, res) => {
    const { user_id } = req.body;
    console.log("Recebido user_id:", user_id);

    // Inicializar o usuário e garantir que o user_id seja tratado como string
    const user = initializeUser(String(user_id));
    
    const userData = restoreEnergy(String(user_id));
    console.log("Dados retornados:", {
        balance: user.balance,
        energy: userData.energy,
        seconds_until_restore: userData.secondsUntilRestore,
        public_address: user.public_address
    });

    res.json({
        status: 'success',
        balance: user.balance,
        energy: userData.energy,
        seconds_until_restore: userData.secondsUntilRestore,
        public_address: user.public_address
    });
});

// Rota para atualizar dados do usuário
app.post('/update_user_data', (req, res) => {
    const { user_id, tokens, energy_change } = req.body;
    console.log("Recebido para atualizar - user_id:", user_id, "tokens:", tokens, "energy_change:", energy_change);

    const wallets = loadWallets();

    // Garantir que o userId seja tratado como string
    const userIdStr = String(user_id);
    
    if (!wallets[userIdStr]) {
        console.log("Usuário não encontrado:", userIdStr);
        return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const user = wallets[userIdStr];
    user.balance += tokens || 0;
    user.energy = Math.max(0, Math.min(60, user.energy + energy_change));
    user.lastEnergyUse = new Date().toISOString();
    saveWallets(wallets);
    
    console.log("Dados atualizados para o usuário:", wallets[userIdStr]);
    res.json({ status: 'success' });
});

// Servir arquivos estáticos da pasta 'public'
app.use(express.static('public'));

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
