# 1. Usamos a imagem estável do Node.js
FROM node:20-bookworm

# 2. Instalamos o ImageMagick e criamos o atalho para o comando 'magick'
# Isso evita o erro 'ENOENT' porque o Linux passará a reconhecer o nome 'magick'
RUN apt-get update && apt-get install -y imagemagick && \
    ln -s /usr/bin/convert /usr/bin/magick && \
    rm -rf /var/lib/apt/lists/*

# 3. Definimos a pasta de trabalho
WORKDIR /app

# 4. Copiamos os arquivos de configuração primeiro (otimiza o cache)
COPY package.json ./

# 5. Instalamos as bibliotecas (agora sem erro de vírgula!)
RUN npm install

# 6. Copiamos o restante do código (incluindo o seu novo server.js)
COPY . .

# 7. Expomos a porta e iniciamos o servidor
EXPOSE 3000
CMD ["node", "server.js"]
