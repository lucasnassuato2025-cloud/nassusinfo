import { friendlyAuthError } from "@/lib/auth-errors";
import { neonClient } from "@/lib/neon";

type AuthResult={error?:{message?:string}|null};
type ResetCapableAuth=typeof neonClient.auth & {resetPassword?:(input:{token:string;newPassword:string})=>Promise<AuthResult>};

export async function requestPasswordReset(email:string,redirectTo:string){
  try{
    const result=await neonClient.auth.requestPasswordReset({email:email.trim().toLocaleLowerCase("pt-BR"),redirectTo});
    if(result.error)throw result.error;
  }catch(reason){throw new Error(friendlyAuthError(reason,"password-reset"));}
}

export async function resetPassword(token:string,newPassword:string){
  const auth=neonClient.auth as ResetCapableAuth;
  if(typeof auth.resetPassword!=="function")throw new Error("A redefinição de senha não está disponível nesta versão do serviço de autenticação.");
  try{
    const result=await auth.resetPassword({token,newPassword});
    if(result.error)throw result.error;
  }catch(reason){throw new Error(friendlyAuthError(reason,"password-reset"));}
}
