# Casa de Castro Alves — Website

Este é o repositório do novo website da **Casa de Castro Alves** (casadecastroalves.com.br), construído utilizando o framework **Astro** para máxima performance, acessibilidade e SEO. 

O design do site foi estruturado para refletir a identidade lírica e histórica do casarão do século XVIII, situado no Centro Histórico de Salvador (ao lado da Igreja do Passo).

---

## 🎨 Identidade Visual & Tipografia
- **Tipografia Editorial (Títulos):** *Times New Roman* (para evocar a herança lírica do poeta Castro Alves).
- **Tipografia de Interface (Ações/Textos de apoio):** *Arial* (para legibilidade e contraste digital).
- **Cores:** 
  - Fundo Creme (`#FFFAE6`)
  - Amarelo CCA (`#F5C800`)
  - Preto Editorial / Carvão (`#1A1A1A`)
  - Branco Puro (`#FFFFFF`)

---

## 📂 Estrutura do Projeto

No diretório do projeto Astro, você encontrará as seguintes páginas principais:

```text
src/
├── components/          # Componentes reutilizáveis (Formulário de contato, Header, Footer)
├── layouts/             # Layout principal com SEO tags e Google Fonts
├── pages/
│   ├── index.astro      # Página Inicial (Hero, citações de poesia, links rápidos)
│   ├── a-casa.astro     # História da Casa, espaços e infraestrutura de casamentos/eventos
│   ├── contato.astro    # Formulário de contato, canais de telefone/e-mail e mapa Google Maps
│   ├── shows.astro      # Listagem geral de shows e espetáculos históricos
│   └── movimento-irun/
│       ├── index.astro  # Apresentação do Movimento Irun e formulário da 11ª Edição
│       ├── cursos.astro # Cursos oferecidos (Permacultura, Cidade Cidadã, etc.)
│       └── [edicao].astro # Páginas individuais das edições históricas
└── styles/
    └── global.css       # Design System de variáveis CSS e estilos globais
```

---

## 🚀 Comandos Úteis

Todos os comandos devem ser executados no terminal a partir da raiz da pasta `site-em-terra-astro`.

> **Nota para Windows (PowerShell):** Devido a políticas de execução de scripts em algumas máquinas Windows, se o comando direto falhar, execute-o usando o bypass de política:
> 
> ```powershell
> powershell -ExecutionPolicy Bypass -Command "npm run dev"
> ```

### Instalar dependências
```sh
npm install
```

### Iniciar servidor de desenvolvimento local
```sh
npm run dev
```
O servidor estará ativo em `http://localhost:4321`.

### Gerar compilação de produção
```sh
npm run build
```

### Visualizar compilação de produção localmente
```sh
npm run preview
```

---

## ⚙️ Integração com Google Sheets (Formulário de Contato)
O formulário de contato envia as respostas diretamente para uma planilha do Google Sheets e dispara alertas e respostas automáticas customizadas. O código do script está localizado no repositório em:
`WORDPRESS/system_design/google_apps_script.js`

---

## 🌐 Publicação no GitHub e Netlify

Para conectar este projeto local ao repositório do GitHub recém-criado, siga estas instruções:

1. **Abra o terminal** na raiz da pasta `site-em-terra-astro`.
2. **Inicialize o Git** (se ainda não tiver inicializado):
   ```sh
   git init
   git branch -M main
   ```
3. **Adicione os arquivos** ao controle de versão:
   ```sh
   git add .
   git commit -m "feat: estrutura inicial do website em Astro"
   ```
4. **Vincule o repositório remoto** do GitHub (substitua pelo link correto):
   ```sh
   git remote add origin https://github.com/casadecastroalves/website.git
   ```
5. **Envie os arquivos**:
   ```sh
   git push -u origin main
   ```
6. **Deploy na Netlify:** Conecte sua conta da Netlify ao repositório `casadecastroalves/website` no GitHub. O deploy será realizado de forma 100% automática a cada push!
