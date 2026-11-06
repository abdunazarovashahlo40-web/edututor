import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LampScene } from './LampScene';
import { OtpStep } from './OtpStep';
import { homeFor, useAuth } from '../../store/auth';

export default function VerifyEmailPage() {
  const [sp] = useSearchParams();
  const loc = useLocation() as { state?: { devCode?: string } };
  const { setMe } = useAuth();
  const nav = useNavigate();
  return (
    <LampScene>
      <OtpStep
        email={sp.get('email') ?? ''}
        devCode={loc.state?.devCode}
        onVerified={(me) => {
          setMe(me);
          nav(homeFor(me.role), { replace: true });
        }}
      />
    </LampScene>
  );
}
