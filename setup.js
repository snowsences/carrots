import {config} from './config.js';
const rules=document.getElementById('rules');
if(config.ownerUids.length===2&&!config.ownerUids.some(u=>u.startsWith('REPLACE_')))rules.textContent=rules.textContent.replace('REPLACE_OWNER_1_UID',config.ownerUids[0]).replace('REPLACE_OWNER_2_UID',config.ownerUids[1]);
for(const [button,source] of [['copyRules','rules'],['copyPrompt','importPrompt']])document.getElementById(button).onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById(source).textContent);document.getElementById('copyNotice').textContent='Copied.';}catch{document.getElementById('copyNotice').textContent='Select the text and copy it manually.';}};
