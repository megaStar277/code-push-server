import path from 'path';
import { I18n } from 'i18n';

export const i18n = new I18n({
    locales: ['en', 'cn'],
    directory: path.join(__dirname, '../../locales'),
    defaultLocale: 'en',
});
