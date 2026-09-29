'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, type FormEvent} from 'react';
import {ArrowLeft, ArrowRight, ChartNoAxesCombined, Eye, EyeOff, ShieldCheck} from 'lucide-react';

import {Button, ErrorMessage, Field} from '@/components/ui';
import {authClient} from '@/lib/auth-client';
import {message} from '@/lib/client';
import {useLanguage, type MessageKey} from '@/lib/i18n';
import {LanguageSelect, ThemeSelect} from '@/components/preference-controls';

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.92V7.46H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.54l3.34-2.62Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5L18.7 4.57A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.46l3.34 2.62c.79-2.37 3-4.13 5.6-4.13Z"/></svg>;
}

export function AuthForm({register = false, initialErrorKey}: {register?: boolean; initialErrorKey?: MessageKey}) {
  const router = useRouter();
  const {t} = useLanguage();
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState<MessageKey|undefined>(initialErrorKey);
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setErrorKey(undefined);
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

  async function continueWithGoogle() {
    if (googleBusy || busy) return;
    setGoogleBusy(true);
    setError('');
    setErrorKey(undefined);
    setNotice('');
    const result = await authClient.signIn.google();
    if (result.error || !result.url) {
      setErrorKey('auth.googleError');
      setGoogleBusy(false);
      return;
    }
    window.location.assign(result.url);
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
      <Link className="auth-home-link" href="/"><ArrowLeft size={15}/>{t('auth.home')}</Link>
      <div className="auth-preferences"><LanguageSelect compact/><ThemeSelect compact/></div><form className="auth-form" onSubmit={submit}>
        <div className="auth-mobile-brand">TRADEDATA</div>
        <span className="eyebrow">{register ? t('auth.start') : t('auth.welcome')}</span>
        <h2>{register ? t('auth.create') : t('auth.back')}</h2>
        <p>{register ? t('auth.createText') : t('auth.signInText')}</p>
        <ErrorMessage error={error || (errorKey ? t(errorKey) : '')}/>
        {notice && <p role="status">{notice}</p>}
        <Button type="button" variant="secondary" className="full-width oauth-button" loading={googleBusy} disabled={busy} aria-busy={googleBusy} onClick={continueWithGoogle}><GoogleIcon/>{googleBusy ? t('auth.googleLoading') : t('auth.google')}</Button>
        <div className="auth-divider"><span>{t('auth.orEmail')}</span></div>
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
        <Button loading={busy} disabled={googleBusy} className="full-width">{register ? t('auth.createButton') : t('auth.signIn')}<ArrowRight size={17}/></Button>
        <p className="auth-switch">{register ? t('auth.existing') : t('auth.new')} <Link href={register ? '/login' : '/register'}>{register ? t('auth.signInLink') : t('auth.createLink')}</Link></p>
      </form>
      <div className="auth-main-foot">{t('auth.disclaimer')}</div>
    </main>
  </div>;
}
