/** Generate one-time isolated QA bootstrap secrets. Do NOT pipe output into logs. */
import {randomBytes} from 'node:crypto';
import {encodeAdminPassword} from '../server/auth.mjs';
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes){let bits=0,acc=0,result='';for(const b of bytes){acc=(acc<<8)|b;bits+=8;while(bits>=5){bits-=5;result+=ALPHABET[(acc>>bits)&31];}}if(bits)result+=ALPHABET[(acc<<(5-bits))&31];return result;}
const password=randomBytes(24).toString('base64url');
const secret=base32(randomBytes(20));
console.log('一次性管理员登录密码（请离线保存，不是普通用户密码）：',password);
console.log('BEE_ADMIN_PASSWORD_SCRYPT='+encodeAdminPassword(password));
console.log('BEE_ADMIN_TOTP_SECRET='+secret);
console.log('在自己的动态口令 App 中手动添加 TOTP: 发行者 Beekeepy-QA, 账户 admin, 密钥为上述 Base32 字符串。');
console.log('不要将密码、TOTP 密钥、SSL PFX 密码发送到聊天或上传 GitHub。');
