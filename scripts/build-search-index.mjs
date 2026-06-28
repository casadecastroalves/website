import { writeFileSync } from 'node:fs';
import { edicoesData } from '../src/data/edicoesData.js';
import { designers } from '../src/data/designCaboclo.js';
import { cursosSearchEntries } from '../src/data/cursosSearch.js';
import parsedEditions from '../src/cms/parsed-editions.json' with { type: 'json' };

const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function editionParsedText(ed) {
  const romanKey = typeof ed.num === 'number' ? romanNumerals[ed.num] : '';
  const parsed = romanKey ? parsedEditions[romanKey] : null;
  if (!parsed) return '';

  return [...(parsed.desc ?? []), ...(parsed.program ?? [])].join(' ');
}

const staticPages = [
  {
    title: 'Home',
    url: '/',
    excerpt: 'Casa de Castro Alves — memória, arte, poesia e Movimento Irun em Salvador.',
    searchText: 'Casa de Castro Alves memória arte poesia Movimento Irun Salvador',
    category: 'Página',
  },
  {
    title: 'A Casa',
    url: '/a-casa',
    excerpt: 'História, espaços, galeria, eventos e jardim com vista para a Baía de Todos os Santos.',
    searchText: 'história galeria jardim baía eventos casarão Castro Alves',
    category: 'Página',
  },
  {
    title: 'Shows & Eventos',
    url: '/shows',
    excerpt: 'Programação de shows, pocket shows e eventos na Casa de Castro Alves.',
    searchText: 'shows eventos programação pocket show',
    category: 'Página',
  },
  {
    title: 'Movimento Irun',
    url: '/movimento-irun',
    excerpt: 'Iniciativa cultural de aliança ancestral, design caboclo, formação e exposições.',
    searchText: 'Movimento Irun design caboclo aliança ancestral formação exposições Márcia Ganem',
    category: 'Movimento Irun',
  },
  {
    title: 'Edições',
    url: '/movimento-irun/edicoes',
    excerpt: 'Todas as edições e pocket shows do Movimento Irun na Casa de Castro Alves.',
    searchText: 'edições pocket shows programação Movimento Irun',
    category: 'Movimento Irun',
  },
  {
    title: 'Cursos',
    url: '/movimento-irun/cursos',
    excerpt: 'Programa Bem Viver, Cidade Cidadã, Permacultura Urbana e formações do Movimento Irun.',
    searchText:
      'Programa Bem Viver Cidade Cidadã Permacultura Urbana cursos formações Inés Grimaux Márcia Ganem Aline Bento Lucyvanda Moura',
    category: 'Movimento Irun',
  },
  {
    title: 'Contato — WhatsApp, Telefone e E-mail',
    url: '/contato',
    excerpt: '71 9 9129 6555 — WhatsApp para agendamentos, visitas e eventos.',
    searchText:
      'contato whatsapp telefone 71 9129 6555 casadecastroalves@gmail.com agendamento visita evento endereço Rua do Passo',
    category: 'Contato',
  },
];

const editionEntries = edicoesData
  .filter((ed) => ed.slug !== '11-edicoes')
  .map((ed) => {
    const isExpo = ed.slug.startsWith('expo-');
    const keywords = [ed.artista, ed.show, ed.data].filter(Boolean).join(' ');
    const searchText = [
      ed.titulo,
      ed.descricao,
      ed.artista,
      ed.show,
      ed.data,
      ed.videoSecTitle,
      ...(ed.detalhes ?? []),
      editionParsedText(ed),
    ]
      .filter(Boolean)
      .join(' ');

    return {
      title: ed.titulo,
      url: `/movimento-irun/${ed.slug}`,
      excerpt: [ed.descricao, keywords].filter(Boolean).join(' ').slice(0, 280),
      searchText,
      category: isExpo ? 'Exposição' : 'Edição',
    };
  });

const designerEntries = designers.map((designer) => {
  const label = designer.projeto ? `${designer.artista} — ${designer.projeto}` : designer.artista;
  const searchText = [
    designer.artista,
    designer.nome,
    designer.projeto,
    designer.instagram,
    designer.especialidade,
    designer.citacao,
    'Design Caboclo',
    'showroom',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    title: `${label} (Design Caboclo)`,
    url: '/movimento-irun/',
    excerpt: `${designer.especialidade}. ${designer.citacao.slice(0, 160)}…`,
    searchText,
    category: 'Design Caboclo',
  };
});

const cursoEntries = cursosSearchEntries.map((curso) => {
  const searchText = [curso.title, curso.facilitador, curso.excerpt, ...(curso.topics ?? [])].join(' ');

  return {
    title: curso.title,
    url: '/movimento-irun/cursos',
    excerpt: curso.excerpt,
    searchText,
    category: 'Curso',
  };
});

const index = [...staticPages, ...editionEntries, ...designerEntries, ...cursoEntries];

writeFileSync(new URL('../public/search-index.json', import.meta.url), JSON.stringify(index, null, 2), 'utf8');
console.log(`Search index: ${index.length} entries`);
