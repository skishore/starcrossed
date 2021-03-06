#!/usr/bin/env python
from __future__ import with_statement
import datetime
import re
import subprocess

def filename_to_title(filename, url):
  assert('_' in filename), 'Expected a filename with underscores, got "%s"' % (filename,)
  title_regex = '&quot;.*' + '.*'.join(list(filename.split('_')[0])) + '.*&quot;'
  command = 'curl %s | grep -o "%s"' % (url, title_regex)
  title_with_quotes = call(command)
  if not title_with_quotes:
    print 'Ran command\n  %s\nbut got no title' % (command,)
    return raw_input('The filename is %s. Enter a title: ' % (filename,))
  return title_with_quotes[6:-6]

def call(command):
  #print 'Calling "%s"' % (command,)
  return subprocess.Popen(command, stdout=subprocess.PIPE, shell=True).stdout.read()[:-1]

def replace_unicode_apostrophes(filename):
  contents = open(filename).read()
  open(filename, 'w').write(contents.replace('\xe2??', "'"))

def scrape_wapo(target, date):
  call('rm *.bin; rm *.jpz; rm *.puz; rm temp')

  domain = 'http://www.sundaycrosswords.com/ccpuz'
  bin_file = call('curl %s/%s | grep -o "[^\\\"]*\\.bin"' % (domain, target))
  assert(bin_file[-4:] == '.bin'), 'Got malformed .bin file: %s' % (bin_file,)
  jpz_file = '%s.jpz' % (bin_file[:-4],)
  puz_file = '%s.puz' % (bin_file[:-4],)

  call('curl %s/%s > %s' % (domain, bin_file, bin_file))
  call('unzip %s' % (bin_file,))

  # These .jpz files are missing a title and author. We to add them manually.
  title = date.strftime('%B %d, %Y - ') + filename_to_title(jpz_file, '%s/%s' % (domain, target))
  call('sed "s/<title><\\/title>/<title>%s<\\/title>/" %s > temp' % (title, jpz_file))
  call('mv temp %s' % (jpz_file,))
  call('sed "s/<creator><\\/creator>/<creator>Merl Reagle<\\/creator>/" %s > temp' % (jpz_file,))
  call('mv temp %s' % (jpz_file,))

  call('java -jar jpz2puz.jar %s' % (jpz_file,))
  try:
    replace_unicode_apostrophes(puz_file)
  except Exception, e:
    print 'Could not find puzzle file: %s' % (e,)
    pass
  call('mv %s ../puz_files/%s\ WaPo.puz' % (puz_file, date.isoformat()[:10]))
  call('rm *.bin; rm *.jpz; rm *.puz; rm temp')

if __name__ == '__main__':
  date_str = call('curl http://www.sundaycrosswords.com/ccpuz/MPuz.php | grep -o "For  puzzle of [0-9]\+/[0-9]\+/[0-9]\+"')
  assert(date_str and date_str[:15] == 'For  puzzle of '), 'Unexpected date "%s"' % (date_str,)
  date = datetime.datetime.strptime(date_str[15:], '%m/%d/%Y') + datetime.timedelta(days=7)
  scrape_wapo('MPuz.php', date)
  scrape_wapo('MPuz1WO.php', date + datetime.timedelta(days=-7))
  scrape_wapo('MPuz2WO.php', date + datetime.timedelta(days=-14))
  scrape_wapo('MPuz3WO.php', date + datetime.timedelta(days=-21))
