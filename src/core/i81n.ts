import { I18n } from 'i18n'
import path from "path"
import { config } from "./config"

export const i18n = new I18n({
    locales: ['cn', 'en'],
    directory: path.join(__dirname, '../../locales'),
    defaultLocale: 'cn'
})

i18n.setLocale(config.local.locale)
