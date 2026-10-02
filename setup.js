import {config} from './config.js';
const rules=document.getElementById('rules');
if(config.ownerUids.length&&!config.ownerUids.some(u=>u.startsWith('REPLACE_')||u.startsWith('pending-owner-'))){
 const members=config.ownerUids.map(uid=>`          '${uid}'`).join(',\n');
 rules.textContent=rules.textContent.replace(/(request\.auth\.uid in \[\n)[\s\S]*?(\n\s*\];)/,`$1${members}$2`);
}
for(const [button,source] of [['copyRules','rules'],['copyPrompt','importPrompt']])document.getElementById(button).onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById(source).textContent);document.getElementById('copyNotice').textContent='Copied.';}catch{document.getElementById('copyNotice').textContent='Select the text and copy it manually.';}};
