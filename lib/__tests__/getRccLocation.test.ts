/* eslint-env jest */

import url from 'url'
import getRccLocation from '../getRccLocation'

test('run as expected', async () => {
  const location = await getRccLocation('tomorrow', 12)
  const urlObj = url.parse(location)
  expect(urlObj).toMatchObject({
    auth: null,
    hash: null,
    host: 'weather-gpv.info',
    hostname: 'weather-gpv.info',
    port: null,
    protocol: 'http:',
    query: null,
    search: null,
    slashes: true
  })
  expect(urlObj.path).toMatch(/^\/msm\/msm_cp_kt_[A-Z0-9.]+\.png$/)
}, 30000)
