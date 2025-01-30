const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { removeBackground } = require("@imgly/background-removal-node");
const cors = require("cors");

const app = express();

// Habilitar CORS
app.use(cors({
  origin: '*', // Para permitir qualquer domínio (pode ser substituído pelo frontend específico)
  methods: ['GET', 'POST'], // Métodos permitidos
  allowedHeaders: ['Content-Type'], // Headers permitidos
  exposedHeaders: ['Content-Disposition'] // Para downloads
}));


// Tornar a pasta 'uploads' acessível publicamente
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do Multer para salvar as imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos.'));
    }
  }
});

app.post("/remove-bg", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhuma imagem enviada" });
      }
  
      let image_src = req.file.path;
  
      // Processamento da imagem
      removeBackground(image_src).then((blob) => {
        blob.arrayBuffer().then((buffer) => {
          const bufferData = Buffer.from(buffer);
          const outputPath = './uploads/processed_' + Date.now() + '.png';
  
          // Após a remoção do fundo, apague a imagem original
          try {
            fs.unlinkSync(image_src);  // Exclui a imagem original
            console.log(`Imagem original ${req.file.filename} deletada após a remoção do fundo.`);
          } catch (deleteErr) {
            console.error("Erro ao excluir a imagem original:", deleteErr);
          }
  
          // Salve a imagem processada
          fs.writeFile(outputPath, bufferData, (err) => {
            if (err) {
              console.error("Erro ao salvar a imagem processada:", err);
              return res.status(500).json({ error: "Erro ao salvar a imagem processada." });
            }
  
            const imageUrl = '/uploads/' + path.basename(outputPath);
            res.json({ imageUrl });
          });
        });
      }).catch((error) => {
        console.error("Erro ao remover o fundo:", error);
      });
    } catch (error) {
      console.error("Erro ao processar a imagem:", error);
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  });
  

// Rota para listar as imagens processadas
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);
  
    // Verifique se o arquivo existe
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
  
      // Enviar o arquivo ao cliente
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error("Erro ao enviar o arquivo:", err);
          return res.status(500).send({ error: "Erro ao enviar o arquivo." });
        }
  
        // Após o envio do arquivo, apague-o
        try {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Erro ao excluir o arquivo:", unlinkErr);
            } else {
              console.log(`Arquivo ${filename} deletado após download.`);
            }
          });
        } catch (deleteErr) {
          console.error("Erro ao tentar excluir o arquivo:", deleteErr);
        }
      });
    } else {
      res.status(404).send({ error: "Arquivo não encontrado" });
    }
  });
  
  

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
