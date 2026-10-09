import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
interface Inspection {hash:string;engine:string;name:string;strategyId:string;revision:number;revisionId:string;rules:string[];runtimeVerified:false;activationAuthorized:false}
const reader=require('./reader.cjs') as {inspectRuleFile:(path:string)=>Promise<Inspection>;inspectionLines:(value:Inspection)=>string[]};
export async function inspectStrategy(path:string):Promise<string[]>{return reader.inspectionLines(await reader.inspectRuleFile(path));}
