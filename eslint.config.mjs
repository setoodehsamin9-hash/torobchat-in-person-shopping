import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';
export default defineConfig([...next,...ts,{rules:{'@next/next/no-img-element':'off','react-hooks/set-state-in-effect':'off','react-hooks/refs':'off','react-hooks/purity':'off'}},globalIgnores(['.next/**','node_modules/**','data/**'])]);
