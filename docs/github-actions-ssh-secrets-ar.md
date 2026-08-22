# إعداد مفتاح SSH وأسرار GitHub Actions لخادم IBM

> **قاعدة أمان:** لا ترسل المفتاح الخاص في المحادثة، ولا تحفظه في المستودع، ولا تضفه إلى `.env`. يوضع فقط داخل GitHub Secrets.

هذا الدليل يستخدم مسارين منفصلين:

| المفتاح              | مكان المفتاح الخاص | الغرض                                             |
| -------------------- | ------------------ | ------------------------------------------------- |
| مفتاح قراءة GitHub   | خادم IBM           | يسمح للخادم بسحب المستودع الخاص للقراءة فقط       |
| مفتاح GitHub Actions | GitHub Secrets     | يسمح لـ GitHub بتشغيل أمر نشر وحيد ومقيّد على IBM |

## 1. أنشئ مستخدم النشر على خادم IBM

سجّل الدخول إلى خادم IBM بحساب إداري ثم نفّذ مرة واحدة:

```bash
sudo adduser --disabled-password --gecos "" amic-deploy
sudo usermod -aG docker amic-deploy
sudo install -d -m 700 -o amic-deploy -g amic-deploy /home/amic-deploy/.ssh
sudo touch /home/amic-deploy/.ssh/authorized_keys
sudo chown amic-deploy:amic-deploy /home/amic-deploy/.ssh/authorized_keys
sudo chmod 600 /home/amic-deploy/.ssh/authorized_keys
```

إذا كان المستخدم موجودًا مسبقًا، ستظهر رسالة تفيد بذلك؛ أكمل بقية الأوامر.

## 2. أنشئ أمر النشر المقيّد على IBM

أنشئ الملف `/usr/local/bin/deploy-amic` على الخادم:

```bash
sudo tee /usr/local/bin/deploy-amic > /dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

export GIT_SSH_COMMAND='ssh -i /home/amic-deploy/.ssh/amic_github_readonly -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes'

cd /opt/amic-platform
git fetch github main
git pull --ff-only github main
docker compose build amic-app
docker compose up -d --no-deps amic-app
docker compose ps amic-app
EOF

sudo chown root:root /usr/local/bin/deploy-amic
sudo chmod 755 /usr/local/bin/deploy-amic
```

هذا الأمر لا يعيد بناء `tradingview-mcp`. يجب أن يكون مجلد `/opt/amic-platform` نسخة Git من المستودع وأن يكون ملف البيئة الإنتاجي متاحًا له كـ `.env` من مسار خارجي وآمن.

## 3. أنشئ مفتاح GitHub Actions على جهاز موثوق

على حاسوبك الشخصي أو بيئة إدارية موثوقة، وليس في مجلد المشروع، نفّذ:

```bash
mkdir -p ~/amic-ssh-keys && chmod 700 ~/amic-ssh-keys
ssh-keygen -t ed25519 -a 100 \
  -f ~/amic-ssh-keys/amic_github_actions \
  -C "github-actions-amic" \
  -N ""
```

سينتج ملفان:

```text
~/amic-ssh-keys/amic_github_actions      ← مفتاح خاص: لا تشاركه ولا ترفعه
~/amic-ssh-keys/amic_github_actions.pub  ← مفتاح عام: سيُضاف إلى IBM
```

## 4. أضف المفتاح العام إلى IBM بأقل صلاحية

اعرض المفتاح العام فقط:

```bash
cat ~/amic-ssh-keys/amic_github_actions.pub
```

انسخ السطر كاملًا الذي يبدأ بـ `ssh-ed25519`، ثم على خادم IBM أضفه إلى ملف المستخدم `amic-deploy` **مع القيود التالية في بداية السطر**:

```bash
sudo nano /home/amic-deploy/.ssh/authorized_keys
```

أضف سطرًا واحدًا بالشكل التالي. استبدل `AAAAC3...` بالمفتاح العام الذي نسخته:

```text
command="/usr/local/bin/deploy-amic",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... github-actions-amic
```

احفظ الملف ثم نفّذ:

```bash
sudo chown amic-deploy:amic-deploy /home/amic-deploy/.ssh/authorized_keys
sudo chmod 600 /home/amic-deploy/.ssh/authorized_keys
```

> هذا التقييد مهم: حتى لو استُخدم مفتاح GitHub، لا يمكنه فتح صدفة SSH أو تنفيذ أمر اختياري؛ ينفذ فقط `/usr/local/bin/deploy-amic`.

## 5. أنشئ قيمة `IBM_KNOWN_HOSTS` وتحقق من البصمة

على خادم IBM، اعرض بصمة مفتاح المضيف ED25519:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

على جهازك الموثوق، استخرج المفتاح العام من الشبكة:

```bash
ssh-keyscan -t ed25519 -H 169.58.168.184 > ~/amic-ssh-keys/ibm_known_hosts
ssh-keygen -lf ~/amic-ssh-keys/ibm_known_hosts
```

لا تتابع قبل أن تتطابق البصمتان. بعد التطابق، يعرض هذا الأمر قيمة السر التي ستنسخها إلى GitHub:

```bash
cat ~/amic-ssh-keys/ibm_known_hosts
```

## 6. أضف الأسرار في GitHub

افتح المستودع الخاص:

`https://github.com/waleedkkk/amic-platform`

ثم اتبع المسار التالي:

```text
Settings → Secrets and variables → Actions → Secrets → New repository secret
```

أنشئ الأسرار الأربعة الآتية، كل واحد على حدة:

| الاسم الدقيق          | القيمة التي تلصقها                                                          |
| --------------------- | --------------------------------------------------------------------------- |
| `IBM_HOST`            | `169.58.168.184`                                                            |
| `IBM_USER`            | `amic-deploy`                                                               |
| `IBM_SSH_PRIVATE_KEY` | محتوى `~/amic-ssh-keys/amic_github_actions` كاملًا، بما فيه سطرا BEGIN وEND |
| `IBM_KNOWN_HOSTS`     | محتوى `~/amic-ssh-keys/ibm_known_hosts` بعد تحقق البصمة                     |

لعرض المفتاح الخاص بهدف نسخه إلى GitHub فقط:

```bash
cat ~/amic-ssh-keys/amic_github_actions
```

لا تستخدم كلمة مرور خادم IBM كسر GitHub، ولا تضف `app.env` أو مفاتيح Twelve Data أو Telegram أو JWT إلى GitHub Secrets لهذا النشر؛ تبقى هذه داخل ملف البيئة المحمي على IBM.

## 7. اختبار آمن قبل أول Push

بعد إضافة المفتاح، يؤدي أي اتصال بهذا المفتاح إلى تشغيل النشر المقيّد. اختبره فقط بعد التأكد من أن `/usr/local/bin/deploy-amic` صحيح:

```bash
ssh \
  -i ~/amic-ssh-keys/amic_github_actions \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=~/amic-ssh-keys/ibm_known_hosts \
  amic-deploy@169.58.168.184
```

يجب أن ترى مخرجات `git pull` و`docker compose build amic-app` وحالة `amic-app`. لا تتوقع صدفة تفاعلية؛ هذا مقصود بسبب تقييد المفتاح.

## 8. بعد اكتمال الأسرار

يصبح ملف `.github/workflows/deploy-ibm.yml` قادرًا على:

1. التشغيل عند كل Push إلى `main` أو عند تشغيل يدوي من تبويب Actions.
2. تنفيذ `pnpm test` و`pnpm check` و`pnpm build` أولًا.
3. إيقاف النشر إذا فشلت أي مرحلة تحقق.
4. تشغيل أمر النشر الوحيد المقيّد على IBM إذا نجحت الفحوص.
5. قياس `https://amic.duckdns.org/analysis` بعد النشر.

## مراجع

[1]: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions "Using secrets in GitHub Actions"
[2]: https://docs.github.com/v3/guides/managing-deploy-keys "Managing deploy keys"
