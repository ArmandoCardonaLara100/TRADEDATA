'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, type FormEvent} from 'react';
import {ArrowRight, ChartNoAxesCombined, Eye, EyeOff, ShieldCheck} from 'lucide-react';

import {Button, ErrorMessage, Field} from '@/components/ui';
import {authClient} from '@/lib/auth-client';
import {message} from '@/lib/client';
import {useLanguage} from '@/lib/i18n';
import {LanguageSelect, ThemeSelect} from '@/components/preference-controls';

export function AuthForm({register = false, initialError = ''}: {register?: boolean; initialError?: string}) {
  const router = useRouter();
  const {t} = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);

    try {
      const credentials = {
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      };
      const result = register
        ? await authClient.signUp.email({...credentials, name: String(form.get('name')).trim()})
        : await authClient.signIn.email(credentials);
      if (result.error) throw new Error(result.error.message || 'Unable to sign in. Check your details.');
      if (result.requiresConfirmation) {setNotice(t('auth.checkEmail'));return;}
      router.push('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-page">
    <div className="auth-aside">
      <Link className="brand" href="/"><span className="brand-mark"><ChartNoAxesCombined size={23}/></span><span>TRADE<span className="brand-light">DATA</span></span></Link>
      <div className="auth-statement">
        <span className="eyebrow">{t('auth.tagline')}</span>
        <h1>{t('auth.statement')}</h1>
        <p>{t('auth.support')}</p>
        <div className="auth-principles"><span>Data</span><span>Discipline</span><span>Probability</span><span>Transparency</span></div>
      </div>
      <div className="auth-foot"><ShieldCheck size={17}/>{t('auth.private')}</div>
    </div>
    <main className="auth-main">
      <div className="auth-preferences"><LanguageSelect compact/><ThemeSelect compact/></div><form className="auth-form" onSubmit={submit}>
        <div className="auth-mobile-brand">TRADEDATA</div>
        <span className="eyebrow">{register ? t('auth.start') : t('auth.welcome')}</span>
        <h2>{register ? t('auth.create') : t('auth.back')}</h2>
        <p>{register ? t('auth.createText') : t('auth.signInText')}</p>
        <ErrorMessage error={error}/>
        {notice && <p role="status">{notice}</p>}
        {register && <Field label={t('auth.name')}><input name="name" autoComplete="name" placeholder="Armando Cardona" required maxLength={80}/></Field>}
        <Field label={t('auth.email')}><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></Field>
        <div className="field">
          <label htmlFor="password">{t('auth.password')}</label>
          <div className="password-field">
            <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'Create a secure password' : 'Enter your password'} minLength={register ? 12 : 1} maxLength={128} required/>
            {register && <small>At least 12 characters. Use a unique password.</small>}
            <button type="button" className="icon-button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
          </div>
        </div>
        <Button loading={busy} className="full-width">{register ? t('auth.createButton') : t('auth.signIn')}<ArrowRight size={17}/></Button>
        <p className="auth-switch">{register ? t('auth.existing') : t('auth.new')} <Link href={register ? '/login' : '/register'}>{register ? t('auth.signInLink') : t('auth.createLink')}</Link></p>
      </form>
      <div className="auth-main-foot">{t('auth.disclaimer')}</div>
    </main>
  </div>;
}
