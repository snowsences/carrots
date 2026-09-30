import {config} from './config.js';
const rules=document.getElementById('rules');
if(config.ownerUids.length===2&&!config.ownerUids.some(u=>u.startsWith('REPLACE_')||u.startsWith('pending-owner-')))rules.textContent=rules.textContent.replace('FIRST_GLAUCO_USER_UID',config.ownerUids[0]).replace('SECOND_GLAUCO_USER_UID',config.ownerUids[1]);
for(const [button,source] of [['copyRules','rules'],['copyPrompt','importPrompt']])document.getElementById(button).onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById(source).textContent);document.getElementById('copyNotice').textContent='Copied.';}catch{document.getElementById('copyNotice').textContent='Select the text and copy it manually.';}};
