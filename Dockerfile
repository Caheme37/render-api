# 1. Pegamos a imagem do Node.js
FROM node:20-bookworm

# 2. Instalamos o ImageMagick e criamos o link simbólico para o comando 'magick'
RUN apt-get update && apt-get install -y imagemagick && \
    ln -s /usr/bin/convert /usr/bin/magick && \
    rm -rf /var/lib/apt/lists/*

# 3. Configuramos a pasta do app
WORKDIR /app

# 4. Copiamos e instalamos as dependências
COPY package.json ./
RUN npm install

# 5. Copiamos o resto do código
COPY . .

# 6. Abrimos a porta e ligamos o servidor
EXPOSE 3000
CMD ["node", "server.js"]
