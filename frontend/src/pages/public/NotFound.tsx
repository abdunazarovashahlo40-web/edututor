import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useI18n } from '../../i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <div className="font-display text-7xl font-bold text-gradient">404</div>
        <p className="mt-3 text-muted">{t('common.empty')}</p>
        <Link to="/" className="mt-6 inline-block">
          <Button>{t('nav.home')}</Button>
        </Link>
      </div>
    </div>
  );
}
