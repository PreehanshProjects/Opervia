import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
 const page = await browser.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:5173');
 await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
 if(!await page.getByRole('button',{name:'Sign in',exact:true}).isEnabled())throw new Error('Sign-in is disabled: Supabase configuration has not loaded.');
 await page.getByRole('button',{name:'Create an account',exact:true}).click();
 if(!await page.getByRole('button',{name:'Create account',exact:true}).isEnabled())throw new Error('Account creation form is disabled.');
 await page.getByRole('button',{name:'Back to sign in'}).click();
 await page.getByRole('button',{name:'Forgot password?'}).click();
 if(!await page.getByRole('button',{name:'Send reset link'}).isEnabled())throw new Error('Password reset form is disabled.');
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Connected UI verified: sign-in, account creation and reset forms are enabled. No accounts created or emails sent. Authenticated saving still requires a confirmed account.');
} finally { await browser.close(); }
