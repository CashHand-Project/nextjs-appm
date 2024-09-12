import logging
import json
import os
from datetime import datetime, timedelta
from telegram import Update, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackContext
from eth_account import Account

# Configuração de logging para depuração
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Caminho para o arquivo wallets.json
wallets_file = r'C:\Users\Makdonei\Downloads\wallets.json'

# Função para carregar as carteiras do arquivo
def load_wallets():
    if os.path.exists(wallets_file) and os.path.getsize(wallets_file) > 0:
        with open(wallets_file, 'r') as f:
            return json.load(f)
    return {}

# Função para salvar as carteiras no arquivo
def save_wallets(wallets):
    with open(wallets_file, 'w') as f:
        json.dump(wallets, f, indent=4)

# Função para gerar uma nova carteira usando o módulo eth_account
def generate_wallet():
    account = Account.create()
    return account.address, account._private_key.hex()

# Função para calcular o tempo restante até a restauração da energia
def get_time_until_energy_restore(last_use):
    if last_use:
        last_use_time = datetime.strptime(last_use, "%Y-%m-%d %H:%M:%S")
        time_diff = datetime.now() - last_use_time
        seconds_passed = time_diff.total_seconds()
        if seconds_passed >= 60:
            return 0  # Energia pronta para restaurar
        else:
            return int(60 - seconds_passed)  # Segundos restantes para restaurar energia
    return 0

# Função para verificar e restaurar energia
def restore_energy(user_id):
    wallets = load_wallets()
    user_data = wallets.get(user_id)

    if user_data:
        last_use = user_data.get('last_energy_use')
        energy = user_data.get('energy', 60)
        seconds_until_restore = get_time_until_energy_restore(last_use)

        if last_use:
            last_use_time = datetime.strptime(last_use, "%Y-%m-%d %H:%M:%S")
            time_diff = datetime.now() - last_use_time
            minutes_passed = int(time_diff.total_seconds() // 60)

            # Restaurar energia proporcional ao tempo passado (1 energia por minuto)
            if minutes_passed >= 1 and energy < 60:
                energy_to_restore = min(60 - energy, minutes_passed)
                energy += energy_to_restore
                user_data['energy'] = energy
                user_data['last_energy_use'] = (last_use_time + timedelta(minutes=energy_to_restore)).strftime("%Y-%m-%d %H:%M:%S")
                save_wallets(wallets)

        # Recalcular o tempo restante para restaurar energia
        seconds_until_restore = get_time_until_energy_restore(user_data['last_energy_use'])
        return user_data['energy'], seconds_until_restore

    return None, None

# Função para inicializar o usuário e criar uma carteira se necessário
def initialize_user(user_id):
    wallets = load_wallets()
    user_id_str = str(user_id)

    if user_id_str not in wallets:
        public_address, private_key = generate_wallet()
        wallets[user_id_str] = {
            "balance": 0,
            "energy": 60,
            "last_energy_use": None,
            "public_address": public_address,
            "private_key": private_key
        }
        save_wallets(wallets)
    else:
        logger.info(f"Usuário {user_id} já existe.")

# Função principal para o comando /start
async def start(update: Update, context: CallbackContext):
    try:
        logger.info(f"Comando /start recebido de {update.message.from_user.id}")
        user_id = update.message.from_user.id
        initialize_user(user_id)

        # Carregar as carteiras e restaurar a energia se necessário
        wallets = load_wallets()
        user_id_str = str(user_id)
        energy, time_until_restore = restore_energy(user_id_str)

        if energy is None:
            await update.message.reply_text("Erro ao carregar os dados do usuário.")
            return

        # Gerar o link do jogo com o user_id incluído
        game_link = f"https://cashhand.info/cashhand/cashhandapp/?user_id={user_id}"

        # Log para verificar se o link está sendo gerado corretamente
        logger.info(f"Link gerado para o jogo: {game_link}")

        # Cria o botão de Web App que abrirá o jogo dentro do Telegram
        keyboard = [
            [InlineKeyboardButton(text="Start Game", web_app=WebAppInfo(url=game_link))]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Envia a mensagem com o botão de Web App e informações da carteira
        await update.message.reply_text(
            text=f"Bem-vindo ao CashHand Game!\nSua energia: {energy}/60\nTempo até a próxima restauração: {time_until_restore}s\nClique no botão abaixo para iniciar o jogo.",
            reply_markup=reply_markup
        )
        logger.info(f"Mensagem enviada para {user_id}")
    except Exception as e:
        logger.error(f"Erro ao processar o comando /start: {e}")
        await update.message.reply_text("Ocorreu um erro ao processar sua solicitação.")

# Função principal para inicializar o bot
def main():
    bot_token = '7443823659:AAFMhsKID1ffdjBZSzeGNu-Mr0RbQ-EVOVQ'

    # Inicializa o bot com o token fornecido
    application = ApplicationBuilder().token(bot_token).build()

    # Adiciona o comando /start
    application.add_handler(CommandHandler("start", start))

    # Inicia o polling do bot
    logger.info("Iniciando polling...")
    application.run_polling()

if __name__ == '__main__':
    main()
