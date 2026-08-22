# النشر التلقائي من GitHub إلى خادم IBM

## الهدف

بعد الإعداد، يصبح المسار كالتالي:

```text
git push github main
        ↓
GitHub: تثبيت الاعتمادات وتشغيل الاختبارات والبناء
        ↓
GitHub: اتصال SSH مقيّد إلى خادم IBM
        ↓
IBM: يجلب أحدث main ويعيد بناء amic-app فقط
        ↓
https://amic.duckdns.org
```

لا تُعاد خدمة `tradingview-mcp` بناؤها في هذا المسار، ولا تُحفظ ملفات البيئة أو الأسرار في GitHub.

## طريقتان ممكنتان

| الطريقة                     | كيف تعمل                                                                            | الملاءمة                      | ملاحظة الأمان                                                   |
| --------------------------- | ----------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| **النشر الآلي بعد كل Push** | يدفع المطوّر إلى `main`، فتُشغّل GitHub الاختبارات ثم تشغّل أمر نشر مقيّدًا على IBM | الطريقة المطلوبة لهذا المشروع | سريعة، لذا يجب حماية `main` وعدم الدفع إليها قبل اختبار التعديل |
| **النشر بموافقة إنتاج**     | نفس الخطوات، لكن يتوقف النشر عند مرحلة موافقة يدوية داخل GitHub                     | خيار أكثر تحفظًا              | مناسب إذا شارك عدة مطورين في المشروع                            |

الخطوات أدناه تشرح الخيار الأول. يمكن إضافة بيئة Production بموافقة لاحقًا من **Settings → Environments**.

## قبل البدء

1. لا تضع أبدًا كلمة مرور خادم IBM أو `app.env` أو مفاتيح API داخل مستودع GitHub.
2. استخدم **مفتاحين مختلفين**: الأول يجعل خادم IBM يقرأ المستودع، والثاني يجعل GitHub يطلق أمر نشر محدودًا على الخادم.
3. أنشئ نسخة احتياطية من `/opt/amic-platform` وملف `app.env` قبل تحويل النشر إلى GitHub.
4. نفّذ الترحيل أول مرة في نافذة صيانة قصيرة؛ سيُعاد بناء `amic-app` عند النشر.

## الخطوة 1: إنشاء مستخدم نشر محدود على خادم IBM

سجّل الدخول إلى IBM بحساب إداري، ثم نفّذ مرة واحدة:

```bash
sudo adduser --disabled-password --gecos "" amic-deploy
sudo usermod -aG docker amic-deploy
sudo install -d -m 700 -o amic-deploy -g amic-deploy /home/amic-deploy/.ssh
sudo install -d -m 700 -o root -g root /etc/amic
sudo cp /opt/amic-platform/app.env /etc/amic/app.env
sudo chmod 600 /etc/amic/app.env
```

يحفظ ذلك ملف بيئة الإنتاج خارج المستودع. لا تحذفه من الخادم.

## الخطوة 2: امنح خادم IBM وصول قراءة فقط إلى المستودع الخاص

على خادم IBM، أنشئ مفتاح نشر مخصصًا للمستودع:

```bash
sudo -u amic-deploy ssh-keygen \
  -t ed25519 \
  -f /home/amic-deploy/.ssh/amic_github_readonly \
  -C "amic-ibm-readonly" \
  -N ""

sudo -u amic-deploy cat /home/amic-deploy/.ssh/amic_github_readonly.pub
```

انسخ **المفتاح العام فقط** الناتج. ثم في GitHub افتح:

`waleedkkk/amic-platform → Settings → Deploy keys → Add deploy key`

سمّه `IBM production read-only` والصق المفتاح العام. اترك خيار **Allow write access** غير محدد؛ الخادم يحتاج القراءة فقط. مفاتيح النشر مرتبطة بمستودع واحد، وهذا هو السبب في تفضيلها على رمز مستخدم واسع الصلاحيات.[3]

اختبر الاتصال من الخادم:

```bash
sudo -u amic-deploy ssh -o StrictHostKeyChecking=accept-new \
  -i /home/amic-deploy/.ssh/amic_github_readonly \
  -T git@github.com
```

## الخطوة 3: انقل نسخة التطبيق إلى GitHub مع إبقاء الأسرار خارجها

> لا تستبدل المجلد الإنتاجي مباشرة قبل حفظ نسخة احتياطية. نفّذ هذه الخطوة مرة واحدة بعد اختبار مفتاح القراءة.

```bash
sudo cp -a /opt/amic-platform /opt/amic-platform.backup-$(date +%F-%H%M%S)
sudo mv /opt/amic-platform /opt/amic-platform.previous
sudo -u amic-deploy GIT_SSH_COMMAND='ssh -i /home/amic-deploy/.ssh/amic_github_readonly -o IdentitiesOnly=yes' \
  git clone git@github.com:waleedkkk/amic-platform.git /opt/amic-platform
sudo ln -s /etc/amic/app.env /opt/amic-platform/app.env
sudo chown -R amic-deploy:amic-deploy /opt/amic-platform
```

ثم أعد تشغيل التطبيق مرة واحدة يدويًا للتحقق من صحة ترحيل المسار:

```bash
cd /opt/amic-platform
sudo -u amic-deploy docker compose build amic-app
sudo -u amic-deploy docker compose up -d --no-deps amic-app
sudo -u amic-deploy docker compose ps amic-app
```

إذا لم يعمل الترحيل، أوقف التطبيق وأعد المجلد السابق من النسخة الاحتياطية بدل متابعة إعداد الأتمتة.

## الخطوة 4: أنشئ أمر النشر الوحيد المسموح لـ GitHub بتشغيله

على خادم IBM، أنشئ `/usr/local/bin/deploy-amic` بالآتي:

```bash
#!/usr/bin/env bash
set -euo pipefail

export GIT_SSH_COMMAND='ssh -i /home/amic-deploy/.ssh/amic_github_readonly -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes'

cd /opt/amic-platform
git fetch github main
git pull --ff-only github main

# لا يُعاد بناء tradingview-mcp هنا.
docker compose build amic-app
docker compose up -d --no-deps amic-app
docker compose ps amic-app
```

ثم اجعله مملوكًا لـ root وقابلًا للتشغيل:

```bash
sudo chown root:root /usr/local/bin/deploy-amic
sudo chmod 755 /usr/local/bin/deploy-amic
```

استخدم `git pull --ff-only` حتى يفشل النشر بدل دمج تعديلات محلية غير مقصودة على الخادم.

## الخطوة 5: أنشئ مفتاح GitHub Actions للوصول إلى IBM

على جهاز إداري موثوق، وليس داخل المستودع، أنشئ مفتاحًا منفصلًا:

```bash
ssh-keygen -t ed25519 -a 100 -f ./amic_github_actions -C "github-actions-amic" -N ""
```

احتفظ بالملف `amic_github_actions` خاصًا وسريًا. انسخ محتوى الملف العام `amic_github_actions.pub`، ثم أضفه إلى:

```bash
sudo tee -a /home/amic-deploy/.ssh/authorized_keys >/dev/null
```

والصيغة الموصى بها في سطر `authorized_keys` هي:

```text
command="/usr/local/bin/deploy-amic",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions-amic
```

بهذا لا يستطيع مفتاح GitHub فتح صدفة أو تشغيل أمر حرّ على الخادم؛ ينفّذ فقط ملف النشر المحدد.

## الخطوة 6: أضف أسرار النشر داخل GitHub

افتح المستودع ثم اذهب إلى:

`Settings → Secrets and variables → Actions → Secrets → New repository secret`

أضف الأسرار التالية:

| الاسم                 | القيمة                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| `IBM_HOST`            | عنوان IP أو اسم نطاق خادم IBM                                                         |
| `IBM_USER`            | `amic-deploy`                                                                         |
| `IBM_SSH_PRIVATE_KEY` | محتوى المفتاح الخاص `amic_github_actions` كاملًا                                      |
| `IBM_KNOWN_HOSTS`     | السطر الموثق لمفتاح المضيف من `ssh-keyscan -H <IBM_HOST>` بعد مقارنة البصمة مع الخادم |

أسرار المستودع تُدار من هذه الصفحة وتُستهلك داخل سير العمل عبر سياق `secrets`.[1]

## الخطوة 7: أضف سير عمل GitHub Actions

أنشئ الملف التالي داخل المستودع:

`/.github/workflows/deploy-ibm.yml`

```yaml
name: Verify and deploy AMIC to IBM

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: amic-production
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Check out source
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Enable pnpm
        run: corepack enable

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Check TypeScript
        run: pnpm exec tsc --noEmit

      - name: Build production bundle
        run: pnpm build

  deploy:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - name: Configure restricted SSH access
        shell: bash
        env:
          IBM_SSH_PRIVATE_KEY: ${{ secrets.IBM_SSH_PRIVATE_KEY }}
          IBM_KNOWN_HOSTS: ${{ secrets.IBM_KNOWN_HOSTS }}
        run: |
          install -d -m 700 ~/.ssh
          printf '%s\n' "$IBM_SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$IBM_KNOWN_HOSTS" > ~/.ssh/known_hosts
          chmod 600 ~/.ssh/known_hosts

      - name: Deploy latest verified main branch
        env:
          IBM_HOST: ${{ secrets.IBM_HOST }}
          IBM_USER: ${{ secrets.IBM_USER }}
        run: |
          ssh -i ~/.ssh/id_ed25519 \
            -o IdentitiesOnly=yes \
            -o StrictHostKeyChecking=yes \
            "$IBM_USER@$IBM_HOST"

      - name: Verify public application endpoint
        run: curl --fail --retry 12 --retry-delay 5 https://amic.duckdns.org/analysis
```

تُخزن ملفات سير العمل في `.github/workflows`، ويمكن قصر حدث `push` على `main` باستخدام فلتر الفروع.[2]

## الخطوة 8: الاختبار الأول ثم التشغيل اليومي

1. ارفع ملف السير عمل في commit منفصل.
2. افتح تبويب **Actions** في GitHub وشغّل **Run workflow** يدويًا أولًا.
3. تحقق من أن مرحلة `verify` نجحت، ثم أن `deploy` أعاد بناء `amic-app` فقط.
4. افحص `https://amic.duckdns.org/analysis` وسجلات الحاوية على IBM.
5. بعد نجاح التجربة، يصبح كل `git push github main` نشرًا تلقائيًا بعد نجاح الاختبارات.

## الاستعادة عند فشل نشر

إذا فشلت الاختبارات، فلن تبدأ مرحلة النشر. إذا فشل بناء الحاوية على IBM، أوقف سير العمل وأعد المجلد الاحتياطي أو شغّل نسخة الحاوية السابقة. لا تستخدم `git reset --hard` كحل سريع على الإنتاج؛ اجعل النشر يفشل بوضوح ثم استعد من النسخة الاحتياطية أو من commit معروف.

## مراجع

[1]: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions "Using secrets in GitHub Actions"
[2]: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions "Workflow syntax for GitHub Actions"
[3]: https://docs.github.com/v3/guides/managing-deploy-keys "Managing deploy keys"
