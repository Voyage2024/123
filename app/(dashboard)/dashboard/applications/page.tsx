'use client';

import MyApplications from '@/app/components/MyApplications';
import { useLanguage } from '@/app/context/LanguageContext';

export default function ResidentApplicationsPage() {
  const { lang } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <MyApplications locale={lang.toLowerCase() as 'ru' | 'en' | 'es' | 'pt'} />
    </div>
  );
}