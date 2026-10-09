import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/companion',{recursive:true});
await copyFile('src/companion/reader.cjs','dist/companion/reader.cjs');
await copyFile('src/companion/provenance.json','dist/companion/provenance.json');
await copyFile('src/companion/READER-LICENSE.txt','dist/companion/READER-LICENSE.txt');
