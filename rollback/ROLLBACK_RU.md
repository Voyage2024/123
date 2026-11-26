# Откат concierge-kyc-guard

Только код, базы пакет не касается.

1. Скопируйте `rollback/app/` поверх репозитория. Вернутся прежние версии:
   - `app/actions/concierge.ts` (из `kyc-full-bundle.zip`);
   - `app/components/concierge/ConciergeAdminChecklist.tsx` (из исходного архива).
2. Commit и Redeploy.

После отката запросы «[Данные KYC]» снова можно закрыть в «Консьерже» обычными кнопками. Блок Identity & KYC в карточке продолжит работать.
