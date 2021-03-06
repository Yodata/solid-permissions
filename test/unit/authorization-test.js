'use strict'

var test = require('tape')
// var rdf = require('rdflib')
var Authorization = require('../../src/authorization')
var acl = Authorization.acl

const resourceUrl = 'https://bob.example.com/docs/file1'
const agentWebId = 'https://bob.example.com/profile/card#me'
// Not really sure what group webIDs will look like, not yet implemented:
const groupWebId = 'https://devteam.example.com/something'

test('a new Authorization()', function (t) {
  let auth = new Authorization()
  t.notOk(auth.isAgent())
  t.notOk(auth.isGroup())
  t.notOk(auth.isPublic())
  t.notOk(auth.webId())
  t.notOk(auth.resourceUrl)
  t.equal(auth.accessType, Authorization.ACCESS_TO)
  t.deepEqual(auth.mailTo, [])
  t.deepEqual(auth.allOrigins(), [])
  t.deepEqual(auth.allModes(), [])
  t.notOk(auth.isInherited(),
    'An Authorization should not be inherited (acl:default) by default')
  t.ok(auth.isEmpty(), 'a new Authorization should be empty')
  t.end()
})

test('a new Authorization for a container', function (t) {
  let auth = new Authorization(resourceUrl, Authorization.INHERIT)
  t.equal(auth.resourceUrl, resourceUrl)
  t.notOk(auth.webId())
  t.notOk(auth.allowsRead())
  t.notOk(auth.allowsWrite())
  t.notOk(auth.allowsAppend())
  t.notOk(auth.allowsControl())
  t.ok(auth.isInherited(),
    'Authorizations for containers should be inherited by default')
  t.equal(auth.accessType, Authorization.DEFAULT)
  t.end()
})

test('Authorization allowsMode() test', function (t) {
  let auth = new Authorization()
  auth.addMode(acl.WRITE)
  t.ok(auth.allowsMode(acl.WRITE), 'auth.allowsMode() should work')
  t.end()
})

test('an Authorization allows editing permission modes', function (t) {
  let auth = new Authorization()
  auth.addMode(acl.CONTROL)
  t.notOk(auth.isEmpty(), 'Adding an access mode means no longer empty')
  t.ok(auth.allowsControl(), 'Adding Control mode failed')
  t.notOk(auth.allowsRead(), 'Control mode should not imply Read')
  t.notOk(auth.allowsWrite(), 'Control mode should not imply Write')
  t.notOk(auth.allowsAppend(), 'Control mode should not imply Append')
  // Notice addMode() is chainable:
  auth
    .addMode(acl.READ)
    .addMode(acl.WRITE)
  t.ok(auth.allowsRead(), 'Adding Read mode failed')
  t.ok(auth.allowsWrite(), 'Adding Write mode failed')
  t.equals(auth.allModes().length, 3)
  auth.removeMode(acl.READ)
  t.notOk(auth.allowsRead(), 'Removing Read mode failed')
  auth.removeMode(acl.CONTROL)
  t.notOk(auth.allowsControl(), 'Removing Control mode failed')

  // Note that removing Append mode while retaining Write mode has no effect
  auth.removeMode(acl.APPEND)
  t.ok(auth.allowsWrite(), 'Removing Append should not remove Write mode')
  t.ok(auth.allowsAppend(),
    'Removing Append while retaining Write mode should have no effect')

  auth.removeMode(acl.WRITE)
  t.notOk(auth.allowsWrite(), 'Removing Write mode failed')
  t.end()
})

test('an Authorization can add or remove multiple modes', function (t) {
  let auth = new Authorization()
  auth.addMode([acl.READ, acl.WRITE, acl.CONTROL])
  t.ok(auth.allowsRead() && auth.allowsWrite() && auth.allowsControl())
  auth.removeMode([acl.WRITE, acl.READ])
  t.notOk(auth.allowsRead() && auth.allowsWrite())
  t.ok(auth.allowsControl())
  t.end()
})

test('an Authorization can only have either an agent or a group', function (t) {
  let auth1 = new Authorization()
  auth1.setAgent(agentWebId)
  t.equal(auth1.agent, agentWebId)
  // Try to set a group while an agent already set
  t.throws(function () {
    auth1.setGroup(groupWebId)
  }, 'Trying to set a group for an auth with an agent should throw an error')
  // Now try the other way -- setting an agent while a group is set
  let auth2 = new Authorization()
  auth2.setGroup(groupWebId)
  t.equal(auth2.group, groupWebId)
  t.throws(function () {
    auth2.setAgent(agentWebId)
  }, 'Trying to set an agent for an auth with a group should throw an error')
  t.end()
})

test('acl.WRITE implies acl.APPEND', function (t) {
  let auth = new Authorization()
  auth.addMode(acl.WRITE)
  t.ok(auth.allowsWrite())
  t.ok(auth.allowsAppend(), 'Adding Write mode implies granting Append mode')
  // But not the other way around
  auth = new Authorization()
  auth.addMode(acl.APPEND)
  t.ok(auth.allowsAppend(), 'Adding Append mode failed')
  t.notOk(auth.allowsWrite(), 'Adding Append mode should not grant Write mode')

  auth.removeMode(acl.WRITE)
  t.ok(auth.allowsAppend(),
    'Removing Write mode when the auth only had Append mode should do nothing')

  auth.removeMode(acl.APPEND)
  t.notOk(auth.allowsAppend(), 'Removing Append mode failed')
  t.end()
})

test('an Authorization can grant Public access', function (t) {
  let auth = new Authorization()
  t.notOk(auth.isPublic(), 'An authorization is not public access by default')

  auth.setPublic()
  t.ok(auth.isPublic(), 'setPublic() results in public access')
  t.equal(auth.group, acl.EVERYONE)
  t.notOk(auth.agent)

  auth = new Authorization()
  auth.setGroup(acl.EVERYONE)
  t.ok(auth.isPublic(),
    'Adding group access to everyone should result in public access')
  t.ok(auth.group, 'Public access authorization is a group authorization')
  t.notOk(auth.agent, 'A public access auth should have a null agent')

  auth = new Authorization()
  auth.setAgent(acl.EVERYONE)
  t.ok(auth.isPublic(),
    'Setting the agent to everyone should be the same as setPublic()')
  t.end()
})

test('an webId is either the agent or the group id', function (t) {
  let auth = new Authorization()
  auth.setAgent(agentWebId)
  t.equal(auth.webId(), auth.agent)
  auth = new Authorization()
  auth.setGroup(groupWebId)
  t.equal(auth.webId(), auth.group)
  t.end()
})

test('hashFragment() on an incomplete authorization should fail', function (t) {
  let auth = new Authorization()
  t.throws(function () {
    auth.hashFragment()
  }, 'hashFragment() should fail if both webId AND resourceUrl are missing')
  auth.setAgent(agentWebId)
  t.throws(function () {
    auth.hashFragment()
  }, 'hashFragment() should fail if either webId OR resourceUrl are missing')
  t.end()
})

test('Authorization.isValid() test', function (t) {
  let auth = new Authorization()
  t.notOk(auth.isValid(), 'An empty authorization should not be valid')
  auth.resourceUrl = resourceUrl
  t.notOk(auth.isValid())
  auth.setAgent(agentWebId)
  t.notOk(auth.isValid())
  auth.addMode(acl.READ)
  t.ok(auth.isValid())
  auth.agent = null
  auth.setGroup(groupWebId)
  t.ok(auth.isValid())
  t.end()
})

test('Authorization origins test', function (t) {
  let auth = new Authorization()
  let origin = 'https://example.com/'
  auth.addOrigin(origin)
  t.deepEqual(auth.allOrigins(), [origin])
  t.ok(auth.allowsOrigin(origin))
  auth.removeOrigin(origin)
  t.deepEqual(auth.allOrigins(), [])
  t.notOk(auth.allowsOrigin(origin))
  t.end()
})

test('Comparing Authorizations test 1', function (t) {
  let auth1 = new Authorization()
  let auth2 = new Authorization()
  t.ok(auth1.equals(auth2))
  t.end()
})

test('Comparing Authorizations test 2', function (t) {
  let auth1 = new Authorization(resourceUrl)
  let auth2 = new Authorization()
  t.notOk(auth1.equals(auth2))
  auth2.resourceUrl = resourceUrl
  t.ok(auth1.equals(auth2))
  t.end()
})

test('Comparing Authorizations test 3', function (t) {
  let auth1 = new Authorization()
  auth1.setAgent(agentWebId)
  let auth2 = new Authorization()
  t.notOk(auth1.equals(auth2))
  auth2.setAgent(agentWebId)
  t.ok(auth1.equals(auth2))
  t.end()
})

test('Comparing Authorizations test 4', function (t) {
  let auth1 = new Authorization()
  auth1.addMode([acl.READ, acl.WRITE])
  let auth2 = new Authorization()
  t.notOk(auth1.equals(auth2))
  auth2.addMode([acl.READ, acl.WRITE])
  t.ok(auth1.equals(auth2))
  t.end()
})

test('Comparing Authorizations test 5', function (t) {
  let auth1 = new Authorization(resourceUrl, Authorization.INHERIT)
  let auth2 = new Authorization(resourceUrl)
  t.notOk(auth1.equals(auth2))
  auth2.inherited = Authorization.INHERIT
  t.ok(auth1.equals(auth2))
  t.end()
})

test('Comparing Authorizations test 6', function (t) {
  let auth1 = new Authorization()
  auth1.addMailTo('alice@example.com')
  let auth2 = new Authorization()
  t.notOk(auth1.equals(auth2))
  auth2.addMailTo('alice@example.com')
  t.ok(auth1.equals(auth2))
  t.end()
})

test('Comparing Authorizations test 7', function (t) {
  let origin = 'https://example.com/'
  let auth1 = new Authorization()
  auth1.addOrigin(origin)
  let auth2 = new Authorization()
  t.notOk(auth1.equals(auth2))
  auth2.addOrigin(origin)
  t.ok(auth1.equals(auth2))
  t.end()
})

test('Authorization.clone() test', function (t) {
  let auth1 = new Authorization(resourceUrl, Authorization.INHERIT)
  auth1.addMode([acl.READ, acl.WRITE])
  let auth2 = auth1.clone()
  t.ok(auth1.equals(auth2))
  t.end()
})
