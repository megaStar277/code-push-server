import { I18n } from 'i18n'
import path from "path"

export const i18n = new I18n({
    locales: ['en', 'cn'],
    directory: path.join(__dirname, '../../locales'),
    defaultLocale: 'en'
})
