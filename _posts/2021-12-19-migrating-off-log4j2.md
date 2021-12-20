---
layout: post
title: Migrating off of Log4j 2.x
discuss_url: https://dev.to/tbroyer/migrating-off-of-log4j-2x-1o64/comments
---

There's been three versions of Log4j in one week to address security flaws,
all of them due to the same _lookups_ feature.
This feature is somewhat unique to Log4j 2.x,
so maybe it wouldn't be a bad idea to ditch Log4j in favor of an , hopefully safer, alternate logger?

Dependencing on the project, changing the logger might range from easy peasy to a multi-week task.
I'm ready to bet that in many (most?) cases, it'd actually be quite easy,
so let's explore how to do it, using [Logback](https://logback.qos.ch/) as the target
(there aren't that many alternatives actually).

Prerequisites
-------------

So first, in which cases would it be relatively easy to move off?

If you're in a situation where you only depend on the [APIs exposed by `log4j-api`](https://logging.apache.org/log4j/2.x/log4j-api/apidocs/index.html)
(put simply: `LogManager`, `Logger`, `Level`, and possibly `ThreadContext` and/or `Marker`),
or even use [Slf4j](https://www.slf4j.org/) instead (with `log4j-slf4j-impl`),
you're in good conditions, but it's not enough.

Another thing to be considered in addition to the logging code itself
is whether you expose your logging configuration to users
(and how: configuration files? JMX?):
migrating away from Log4j will obviously change the way you (they) configure logging.

And finally, logging frameworks being extensible,
have a look at which such extensions you're using,
and whether they have alternatives for other loggers.
For example, if you're using `sentry-log4j2`,
know that there's an equivalent `sentry-logback` for Logback.

I'll assume a very simple, but totally realistic, setup
(realistic because that's what I've been using in most apps I've written over the past few years).

Changing dependencies
---------------------

Putting aside configuration for a moment,
let's have a look at what needs to be changed in the project dependencies.

If you're using Slf4j as your logging API,
then you'll switch `log4j-slf4j-impl` to `logback-classic`.
If you're using the Log4j API directly,
then your final setup should have `log4j-api`, `log4j-to-slf4j`, and `logback-classic`.

If you had other adapters or bridges, replace them accordingly:

| From | To |
| ---- | -- |
| `log4j-jcl` | `jcl-over-slf4j` |
| `log4j-1.2-api` | `log4j-over-slf4j` |
| `log4j-jul` | `jul-to-slf4j` |
| `log4j-jpl` | No alternative, but you can copy [the one from Slf4j 2](https://github.com/qos-ch/slf4j/tree/master/slf4j-jdk-platform-logging/src/main/java/org/slf4j/jdk/platform/logging) |

At this point, you should no longer have `log4j-core` in your dependencies,
either directly or transitively.

### A note on dependency management

It's important to have only one logger in your runtime dependencies,
and make sure you don't have conflicts between adapters/bridges.
Louis Jacomet wrote a [great blog post over at Gradle's blog](https://blog.gradle.org/addressing-logging-complexity-capabilities) on the subject.

If you're using Maven, use `mvn dependency:tree` to figure out which dependencies you have, and where they come from;
then use [dependency exclusions](https://maven.apache.org/guides/introduction/introduction-to-optional-and-excludes-dependencies.html#dependency-exclusions) if needed to remove unwanted transitive dependencies
as you replace them with the appropriate adapter, bridge or implementation.

If you're using Gradle, I cannot recommend Louis Jacomet's [`logging-capabilities` plugin](https://github.com/ljacomet/logging-capabilities) enough!

If you're already using it, don't forget to switch from
```kotlin
loggingCapabilities {
    enforceLog4J2()
}
```
to
```kotlin
loggingCapabilities {
    enforceLogback()
}
```

Migrating configuration files
-----------------------------

The next step is migrating configuration files
so you can get an equivalent behavior.

I'll take a couple simple examples, again taken from real applications.

### Logging to the console

For apps running in Docker containers, or sometimes through systemd,
it's useful to have the application log directly to the console.

This Log4j 2 configuration:

```xml
<Configuration>
  <Appenders>
    <Console name="Console" target="SYSTEM_OUT">
      <PatternLayout pattern="%d{ISO8601_OFFSET_DATE_TIME_HHCMM}{Europe/Paris} %p %c{1.} [%t] %m%n"/>
    </Console>
  </Appenders>
  <Loggers>
    <Root level="info">
      <AppenderRef ref="Console"/>
    </Root>
  </Loggers>
</Configuration>
```

will become for Logback:

```xml
<configuration>
  <shutdownHook/>
  <appender name="Console" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{"yyyy-MM-dd'T'HH:mm:ss,SSSXXX", Europe/Paris} [%thread] %p %c{1} [%t] %m%n</pattern>
    </encoder>
  </appender>

  <root level="info">
    <appender-ref ref="Console" />
  </root>
</configuration>
```

### Logging to a file

For applications that prefer logging to files, with a rolling strategy
(here also using an asynchronous logger),
this Log4j 2 configuration file:

```xml
<Configuration>
  <Appenders>
    <Async name="AsyncLogFile">
      <AppenderRef ref="LogFile" />
    </Async>
    <RollingFile name="LogFile"
      fileName="/var/log/myapp/myapp.log"
      filePattern="/var/log/myapp/myapp-%d{yyyy-MM-dd}.log.gz">
      <PatternLayout>
        <Pattern>%d %p %c{1.} [%t] %m%n</Pattern>
      </PatternLayout>
      <Policies>
        <TimeBasedTriggeringPolicy />
      </Policies>
    </RollingFile>
  </Appenders>
  <Loggers>
    <Root level="info">
      <AppenderRef ref="AsyncLogFile" />
    </Root>
  </Loggers>
</Configuration>
```

will become for Logback:

```xml
<configuration>
  <shutdownHook/>
  <appender name="AsyncLogFile" class="ch.qos.logback.classic.AsyncAppender">
    <appender-ref ref="LogFile" />
  </appender>
  <appender name="LogFile" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <file>/var/log/myapp/myapp.log</file>
    <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
      <fileNamePattern>/var/log/myapp/myapp-%d{yyy-MM-dd}.log.gz</fileNamePattern>
      <maxHistory>7</maxHistory>
    </rollingPolicy>
    <encoder>
      <pattern>%d %p %c{1} [%t] %m%n</pattern>
    </encoder>
  </appender>
  <root level="info">
    <appender-ref ref="AsyncLogFile" />
  </root>
</configuration>
```

### Sending logs to Sentry

The easiest way to use Sentry is to configure it as a log appender,
in general in addition to some other appender(s) as seen above.

The following Log4j 2 configuration file snippet:
```xml
<Configuration>
  <Appenders>
    <!-- … -->
    <Sentry name="Sentry"
            minimumEventLevel="WARN"
            minimumBreadcrumbLevel="DEBUG"
    />
  </Appenders>
  <Loggers>
    <Root level="info">
      <!-- … -->
      <AppenderRef ref="Sentry" level="warn" />
    </Root>
  </Loggers>
</Configuration>
```

will become for Logback:
```xml
<configuration>
  <!-- … -->
  <appender name="Sentry" class="io.sentry.logback.SentryAppender">
    <minimumEventLevel>WARN</minimumEventLevel>
    <minimumBreadcrumbLevel>DEBUG</minimumBreadcrumbLevel>
  </appender>
  <root level="info">
    <!-- … -->
    <appender-ref ref="Sentry" />
  </root>
</configuration>
```

### Other things to note

If you're using a `log4j2.component.properties` file,
you'll have to replace it with explicit `System.setProperty()` in code as early as possible
(before Logback is initialized),
or with other equivalent ways to achieve the same.

In this file, in apps I've written,
I've been using `log4j2.isWebapp=false`
and `log4j.contextSelector=org.apache.logging.log4j.core.async.AsyncLoggerContextSelector`
to make all appenders asynchronous.

There's no equivalent to `log4j2.isWebapp`,
because Logback does not change its behavior depending on the presence of the servlet class in the classpath.

As for the `AsyncLoggerContextSelector`, you'd have to explicitly use `AsyncAppender`s in the configuration file
(there might be a way to configure Logback/Joran to automatically wrap all appenders with an `AsyncAppender` but let's be explicit).

Linking the dots
----------------

The last thing to do is making sure the application uses the configuration file.

The way Log4j 2 and Logback search for their configuration file is quite similar:
first a system property,
then files in the classpath,
and finally fallback to the console.

If you're using the system property,
change it from `log4j2.configurationFile` to `logback.configurationFile`
in all your Docker entrypoints, systemd service units, shell scripts, etc.

If you're using a file on the classpath,
it'll have to be named `logback.xml` rather than `log4j2.xml`
(or `logback-test.xml` rather than `log4j2-test.xml`).

Conclusion
----------

Those 3 steps (dependencies, configuration file, finding the configuration file)
should be enough for many, if not most, applications
for migrating off of Log4j 2.
I'm not saying this is a good thing and you should do it,
but if, in the light of this cascade of flaws in Log4j 2,
you envisioned switching away, those would be the steps to follow.
