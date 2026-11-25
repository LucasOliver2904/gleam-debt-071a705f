import { parseBrlCents } from "./finance";
import { statementCategory } from "./statement-import";
import { localDayKey } from "./planning";

export function parseQuickPhrase(raw:string,categories:readonly string[],today=new Date()) {
  let text=raw.trim().replace(/\s+/g," ");
  const kind: "entrada" | "saida" = /^(recebi|ganhei|entrou|entrada)\b/i.test(text)?"entrada":"saida";
  text=text.replace(/^(recebi|ganhei|entrou|entrada|gastei|paguei|comprei|saida|saída)\s+/i,"");
  const match=text.match(/^(?:R\$\s*)?(\d+(?:[.,]\d+)*)(?:\s+(mil)\b)?\s+(.+)$/i);
  if(!match)return null;
  const amount=parseBrlCents(match[1]!);if(amount===null)return null;
  const total=amount*(match[2]?1000:1);
  if(total<=0||total>100_000_000_000||!Number.isSafeInteger(total))return null;
  let description=match[3]!.trim(), date=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const relative=description.match(/\s+(hoje|ontem|anteontem)$/i);
  const day=description.match(/\s+dia\s+(\d{1,2})$/i);
  if(relative){date.setDate(date.getDate()-(relative[1]!.toLowerCase()==="ontem"?1:relative[1]!.toLowerCase()==="anteontem"?2:0));description=description.slice(0,relative.index).trim();}
  else if(day){const d=Number(day[1]);if(d<1||d>new Date(today.getFullYear(),today.getMonth()+1,0).getDate())return null;date.setDate(d);description=description.slice(0,day.index).trim();}
  if(!description||description.length>100)return null;
  const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const exact=categories.find(c=>norm(c)===norm(description));
  const predicted=exact??statementCategory(description,kind);
  return {kind,description,amount:(total/100).toFixed(2).replace(".",","),category:categories.includes(predicted)?predicted:"Outros",date:localDayKey(date)};
}
