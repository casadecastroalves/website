import { writeFileSync } from 'node:fs';
import { edicoesData } from '../src/data/edicoesData.js';

const staticPages = [
  {
    title: 'Home',
    url: '/',
    excerpt: 'Casa de Castro Alves — memória, arte, poesia e Movimento Irun em Salvador.',
    category: 'Página',
  },
  {
    title: 'A Casa',
    url: '/a-casa',
    excerpt: 'História, espaços, galeria, eventos e jardim com vista para a Baía de Todos os Santos.',
    category: 'Página',
  },
  {
    title: 'Shows & Eventos',
    url: '/shows',
    excerpt: 'Programação de shows, pocket shows e eventos na Casa de Castro Alves.',
    category: 'Página',
  },
  {
    title: 'Movimento Irun',
    url: '/movimento-irun',
    excerpt: 'Iniciativa cultural de aliança ancestral, design caboclo, formação e exposições.',
    category: 'Movimento Irun',
  },
  {
    title: 'Edições',
    url: '/movimento-irun/edicoes',
    excerpt: 'Todas as edições e pocket shows do Movimento Irun na Casa de Castro Alves.',
    category: 'Movimento Irun',
  },
  {
    title: 'Cursos',
    url: '/movimento-irun/cursos',
    excerpt: 'Programa Bem Viver, Cidade Cidadã, Permacultura Urbana e formações do Movimento Irun.',
    category: 'Movimento Irun',
  },
  {
    title: 'Contato',
    url: '/contato',
    excerpt: 'Agende visitas, eventos e entre em contacto com a Casa de Castro Alves.',
    category: 'Página',
  },
];

const editionEntries = edicoesData
  .filter((ed) => ed.slug !== '11-edicoes')
  .map((ed) => {
    const isExpo = ed.slug.startsWith('expo-');
    const keywords = [ed.artista, ed.show, ed.data].filter(Boolean).join(' ');

    return {
      title: ed.titulo,
      url: `/movimento-irun/${ed.slug}`,
      excerpt: [ed.descricao, keywords].filter(Boolean).join(' ').slice(0, 280),
      category: isExpo ? 'Exposição' : 'Edição',
    };
  });

const index = [...staticPages, ...editionEntries];

writeFileSync(new URL('../public/search-index.json', import.meta.url), JSON.stringify(index, null, 2), 'utf8');
console.log(`Search index: ${index.length} entries`);
