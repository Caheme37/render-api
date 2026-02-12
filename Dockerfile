# 1. Pegamos uma imagem do Node.js pronta (o motor)
FROM node:20-bookworm

# 2. Instalamos o ImageMagick (a ferramenta que edita as fotos)
RUN apt-get update && apt-get install -y imagemagick && rm -rf /var/lib/apt/lists/*

# 3. Criamos uma pasta para o projeto dentro da "máquina"
WORKDIR /app

# 4. Copiamos os arquivos que você criou para dentro dela
COPY package.json ./
RUN npm install
COPY server.js ./

# 5. Abrimos a porta 3000 para o mundo
EXPOSE 3000

# 6. Ligamos o motor!
CMD ["node", "server.js"]
