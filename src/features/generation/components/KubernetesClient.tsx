'use client'

import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Copy,
  Download,
  FileCode2,
  Network,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { InputCapNotice } from '@/components/ui/input-cap-notice'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'
import {
  createOutputPreview,
  isOutputPreviewLimited,
  OUTPUT_PREVIEW_CHARS,
  OUTPUT_PREVIEW_ROWS
} from '@/utils/outputPreview'

const WORKLOAD_TYPES = ['deployment', 'statefulset', 'cronjob'] as const
const SERVICE_TYPES = ['ClusterIP', 'NodePort', 'LoadBalancer'] as const
const OUTPUT_TYPES = ['manifests', 'kustomization', 'helm', 'kubectl', 'markdown', 'json'] as const
const WORKSPACE_LIMIT = 90000
const DRAFT_FIELD_LIMIT = 1200
const KEY_LIST_INPUT_LIMIT = 4000
const KEY_LIST_LINE_LIMIT = 80
const PARSED_RENDER_LIMIT = 100
const FINDING_RENDER_LIMIT = 80
type YamlModule = typeof import('yaml')

type WorkloadType = (typeof WORKLOAD_TYPES)[number]
type ServiceType = (typeof SERVICE_TYPES)[number]
type OutputType = (typeof OUTPUT_TYPES)[number]
type FindingLevel = 'danger' | 'good' | 'warn'

interface KubernetesDraft {
  appName: string
  configKeys: string
  containerPort: string
  cpuLimit: string
  cpuRequest: string
  healthPath: string
  imageName: string
  imageTag: string
  includeConfigMap: boolean
  includeCronJob: boolean
  includeHpa: boolean
  includeIngress: boolean
  includeNetworkPolicy: boolean
  includePdb: boolean
  includeSecret: boolean
  includeService: boolean
  includeServiceAccount: boolean
  ingressHost: string
  memoryLimit: string
  memoryRequest: string
  namespace: string
  pathPrefix: string
  publicIngress: boolean
  readOnlyRootFilesystem: boolean
  replicas: string
  runAsNonRoot: boolean
  schedule: string
  secretKeys: string
  serviceType: ServiceType
  useProbes: boolean
  useResources: boolean
  workloadType: WorkloadType
}

interface Preset {
  draft: KubernetesDraft
  key: string
  workspace: string
}

interface ParsedResource {
  containerCount: number
  hasIngressTls: boolean
  hasNetworkPolicy: boolean
  hasProbes: boolean
  hasResources: boolean
  hasSecurityContext: boolean
  images: string[]
  kind: string
  name: string
  namespace: string
  plaintextSensitiveEnv: string[]
  replicas: number | null
  serviceType: string
}

interface ParsedKubernetes {
  capped: boolean
  errors: string[]
  kinds: Record<string, number>
  resources: ParsedResource[]
}

const EMPTY_PARSED_KUBERNETES: ParsedKubernetes = {
  capped: false,
  errors: [],
  kinds: {},
  resources: []
}

interface Finding {
  key: string
  level: FindingLevel
  subject: string
}

const DEFAULT_DRAFT: KubernetesDraft = {
  appName: 'daily-tools',
  configKeys: 'NODE_ENV\nNEXT_PUBLIC_SITE_URL',
  containerPort: '3000',
  cpuLimit: '500m',
  cpuRequest: '100m',
  healthPath: '/api/health',
  imageName: 'ghcr.io/garland/daily-tools',
  imageTag: '1.0.0',
  includeConfigMap: true,
  includeCronJob: false,
  includeHpa: true,
  includeIngress: true,
  includeNetworkPolicy: true,
  includePdb: true,
  includeSecret: true,
  includeService: true,
  includeServiceAccount: true,
  ingressHost: 'tools.example.com',
  memoryLimit: '512Mi',
  memoryRequest: '128Mi',
  namespace: 'daily-tools',
  pathPrefix: '/',
  publicIngress: false,
  readOnlyRootFilesystem: true,
  replicas: '2',
  runAsNonRoot: true,
  schedule: '0 2 * * *',
  secretKeys: 'DATABASE_URL\nJWT_SECRET',
  serviceType: 'ClusterIP',
  useProbes: true,
  useResources: true,
  workloadType: 'deployment'
}

const PRESETS: Preset[] = [
  {
    key: 'next',
    draft: DEFAULT_DRAFT,
    workspace: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: daily-tools
  namespace: daily-tools
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: daily-tools
  template:
    metadata:
      labels:
        app.kubernetes.io/name: daily-tools
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: app
          image: ghcr.io/garland/daily-tools:1.0.0
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: daily-tools
  namespace: daily-tools
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app.kubernetes.io/name: daily-tools
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: daily-tools-allow-http
  namespace: daily-tools
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: daily-tools
  policyTypes:
    - Ingress
  ingress:
    - ports:
        - protocol: TCP
          port: 3000`
  },
  {
    key: 'api',
    draft: {
      ...DEFAULT_DRAFT,
      appName: 'api',
      configKeys: 'NODE_ENV\nAPI_BASE_URL',
      containerPort: '8080',
      healthPath: '/healthz',
      imageName: 'ghcr.io/acme/api',
      ingressHost: 'api.example.com',
      namespace: 'platform',
      secretKeys: 'DATABASE_URL\nREDIS_URL\nAPI_TOKEN'
    },
    workspace: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: platform
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api
          image: ghcr.io/acme/api:1.0.0
          ports:
            - containerPort: 8080
          envFrom:
            - secretRef:
                name: api-secret
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 1
              memory: 768Mi`
  },
  {
    key: 'worker',
    draft: {
      ...DEFAULT_DRAFT,
      appName: 'queue-worker',
      containerPort: '9000',
      healthPath: '/healthz',
      imageName: 'ghcr.io/acme/queue-worker',
      includeIngress: false,
      includeService: false,
      replicas: '3',
      secretKeys: 'REDIS_URL\nQUEUE_TOKEN',
      workloadType: 'deployment'
    },
    workspace: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: queue-worker
  namespace: daily-tools
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: worker
          image: ghcr.io/acme/queue-worker:1.0.0
          envFrom:
            - secretRef:
                name: queue-worker-secret
          resources:
            requests:
              cpu: 100m
              memory: 128Mi`
  },
  {
    key: 'cronjob',
    draft: {
      ...DEFAULT_DRAFT,
      appName: 'nightly-cleanup',
      containerPort: '8080',
      healthPath: '/healthz',
      imageName: 'ghcr.io/acme/nightly-cleanup',
      includeCronJob: true,
      includeHpa: false,
      includeIngress: false,
      includePdb: false,
      includeService: false,
      replicas: '1',
      schedule: '15 3 * * *',
      secretKeys: 'MAINTENANCE_TOKEN',
      workloadType: 'cronjob'
    },
    workspace: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-cleanup
  namespace: daily-tools
spec:
  schedule: "15 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: job
              image: ghcr.io/acme/nightly-cleanup:1.0.0
              resources:
                requests:
                  cpu: 100m
                  memory: 128Mi`
  },
  {
    key: 'risk',
    draft: {
      ...DEFAULT_DRAFT,
      imageTag: 'latest',
      includeConfigMap: false,
      includeHpa: false,
      includeNetworkPolicy: false,
      includePdb: false,
      includeSecret: false,
      includeServiceAccount: false,
      publicIngress: true,
      readOnlyRootFilesystem: false,
      replicas: '1',
      runAsNonRoot: false,
      secretKeys: 'DATABASE_URL\nJWT_SECRET',
      serviceType: 'LoadBalancer',
      useProbes: false,
      useResources: false
    },
    workspace: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: risky-web
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: web
          image: ghcr.io/acme/risky-web:latest
          securityContext:
            privileged: true
            runAsUser: 0
          env:
            - name: DATABASE_URL
              value: postgres://user:pass@example/db
            - name: JWT_SECRET
              value: plaintext-secret
          ports:
            - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: risky-web
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: risky-web
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: risky-web
spec:
  rules:
    - host: risky.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: risky-web
                port:
                  number: 80`
  }
]

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function toLines(value: string, limit = KEY_LIST_LINE_LIMIT) {
  return value
    .slice(0, KEY_LIST_INPUT_LIMIT)
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function toSlug(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

function toInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getRecordAt(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record

  for (const key of path) {
    const currentRecord = asRecord(current)
    if (!currentRecord) return null
    current = currentRecord[key]
  }

  return asRecord(current)
}

function getArrayAt(record: Record<string, unknown>, path: string[]) {
  let current: unknown = record

  for (const key of path) {
    const currentRecord = asRecord(current)
    if (!currentRecord) return []
    current = currentRecord[key]
  }

  return Array.isArray(current) ? current : []
}

function getString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function stringifyYaml(yaml: YamlModule, value: unknown) {
  return yaml
    .stringify(value, {
      indent: 2,
      lineWidth: 0
    })
    .trim()
}

function downloadText(content: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildLabels(name: string) {
  return {
    'app.kubernetes.io/name': name,
    'app.kubernetes.io/part-of': name
  }
}

function buildSecretData(keys: string[]) {
  return keys.reduce<Record<string, string>>((acc, key) => {
    acc[key] = 'CHANGE_ME'
    return acc
  }, {})
}

function buildConfigData(keys: string[]) {
  return keys.reduce<Record<string, string>>((acc, key) => {
    acc[key] = key === 'NODE_ENV' ? 'production' : ''
    return acc
  }, {})
}

function buildContainer(draft: KubernetesDraft, name: string, port: number) {
  const configKeys = toLines(draft.configKeys)
  const secretKeys = toLines(draft.secretKeys)
  const image = `${draft.imageName.trim() || 'example/app'}:${draft.imageTag.trim() || 'latest'}`
  const container: Record<string, unknown> = {
    name,
    image,
    imagePullPolicy: draft.imageTag.trim() === 'latest' ? 'Always' : 'IfNotPresent',
    ports: [{ name: 'http', containerPort: port }]
  }

  const envFrom: Record<string, unknown>[] = []
  if (draft.includeConfigMap && configKeys.length > 0)
    envFrom.push({ configMapRef: { name: `${name}-config` } })
  if (draft.includeSecret && secretKeys.length > 0)
    envFrom.push({ secretRef: { name: `${name}-secret` } })
  if (envFrom.length > 0) container.envFrom = envFrom

  if (draft.useProbes) {
    const probe = {
      httpGet: {
        path: draft.healthPath.trim() || '/',
        port
      },
      initialDelaySeconds: 10,
      periodSeconds: 15,
      timeoutSeconds: 3
    }
    container.readinessProbe = probe
    container.livenessProbe = probe
  }

  if (draft.useResources) {
    container.resources = {
      requests: {
        cpu: draft.cpuRequest.trim() || '100m',
        memory: draft.memoryRequest.trim() || '128Mi'
      },
      limits: {
        cpu: draft.cpuLimit.trim() || '500m',
        memory: draft.memoryLimit.trim() || '512Mi'
      }
    }
  }

  if (draft.runAsNonRoot || draft.readOnlyRootFilesystem) {
    container.securityContext = {
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: draft.readOnlyRootFilesystem,
      runAsNonRoot: draft.runAsNonRoot
    }
  }

  return container
}

function buildPodSpec(draft: KubernetesDraft, name: string, port: number) {
  const spec: Record<string, unknown> = {
    containers: [buildContainer(draft, name, port)]
  }

  if (draft.includeServiceAccount) spec.serviceAccountName = name
  if (draft.runAsNonRoot) {
    spec.securityContext = {
      runAsNonRoot: true,
      seccompProfile: { type: 'RuntimeDefault' }
    }
  }

  return spec
}

function buildManifests(draft: KubernetesDraft) {
  const name = toSlug(draft.appName, 'app')
  const namespace = toSlug(draft.namespace, 'default')
  const labels = buildLabels(name)
  const port = toInt(draft.containerPort, 3000)
  const replicas = toInt(draft.replicas, 1)
  const manifests: Record<string, unknown>[] = [
    {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: namespace }
    }
  ]

  if (draft.includeServiceAccount) {
    manifests.push({
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: { name, namespace, labels }
    })
  }

  const configData = buildConfigData(toLines(draft.configKeys))
  if (draft.includeConfigMap && Object.keys(configData).length > 0) {
    manifests.push({
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: `${name}-config`, namespace, labels },
      data: configData
    })
  }

  const secretData = buildSecretData(toLines(draft.secretKeys))
  if (draft.includeSecret && Object.keys(secretData).length > 0) {
    manifests.push({
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: `${name}-secret`, namespace, labels },
      type: 'Opaque',
      stringData: secretData
    })
  }

  if (draft.workloadType === 'cronjob' || draft.includeCronJob) {
    manifests.push({
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: { name, namespace, labels },
      spec: {
        schedule: draft.schedule.trim() || '0 2 * * *',
        concurrencyPolicy: 'Forbid',
        successfulJobsHistoryLimit: 3,
        failedJobsHistoryLimit: 3,
        jobTemplate: {
          spec: {
            backoffLimit: 2,
            template: {
              metadata: { labels },
              spec: {
                ...buildPodSpec(draft, name, port),
                restartPolicy: 'OnFailure'
              }
            }
          }
        }
      }
    })
  } else {
    const workloadKind = draft.workloadType === 'statefulset' ? 'StatefulSet' : 'Deployment'
    const workloadSpec: Record<string, unknown> = {
      replicas,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: buildPodSpec(draft, name, port)
      }
    }
    if (workloadKind === 'StatefulSet') workloadSpec.serviceName = name

    manifests.push({
      apiVersion: 'apps/v1',
      kind: workloadKind,
      metadata: { name, namespace, labels },
      spec: workloadSpec
    })
  }

  if (draft.includeService) {
    manifests.push({
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name, namespace, labels },
      spec: {
        type: draft.serviceType,
        selector: labels,
        ports: [{ name: 'http', port: 80, targetPort: port }]
      }
    })
  }

  if (draft.includeIngress) {
    const ingressSpec: Record<string, unknown> = {
      rules: [
        {
          host: draft.ingressHost.trim() || `${name}.example.com`,
          http: {
            paths: [
              {
                path: draft.pathPrefix.trim() || '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name,
                    port: { number: 80 }
                  }
                }
              }
            ]
          }
        }
      ]
    }

    if (!draft.publicIngress) {
      ingressSpec.tls = [
        {
          hosts: [draft.ingressHost.trim() || `${name}.example.com`],
          secretName: `${name}-tls`
        }
      ]
    }

    manifests.push({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name,
        namespace,
        labels,
        annotations: draft.publicIngress ? {} : { 'cert-manager.io/cluster-issuer': 'letsencrypt' }
      },
      spec: ingressSpec
    })
  }

  if (draft.includeHpa && draft.workloadType !== 'cronjob' && !draft.includeCronJob) {
    manifests.push({
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: { name, namespace, labels },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: draft.workloadType === 'statefulset' ? 'StatefulSet' : 'Deployment',
          name
        },
        minReplicas: Math.max(2, replicas),
        maxReplicas: Math.max(4, replicas * 3),
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: { type: 'Utilization', averageUtilization: 70 }
            }
          }
        ]
      }
    })
  }

  if (draft.includePdb && draft.workloadType !== 'cronjob' && !draft.includeCronJob) {
    manifests.push({
      apiVersion: 'policy/v1',
      kind: 'PodDisruptionBudget',
      metadata: { name, namespace, labels },
      spec: {
        minAvailable: replicas > 1 ? 1 : 0,
        selector: { matchLabels: labels }
      }
    })
  }

  if (draft.includeNetworkPolicy) {
    manifests.push({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { name: `${name}-allow-http`, namespace, labels },
      spec: {
        podSelector: { matchLabels: labels },
        policyTypes: ['Ingress'],
        ingress: [
          {
            ports: [{ protocol: 'TCP', port }]
          }
        ]
      }
    })
  }

  return manifests
}

function manifestsToYaml(yaml: YamlModule, manifests: Record<string, unknown>[]) {
  return manifests.map(manifest => stringifyYaml(yaml, manifest)).join('\n---\n')
}

function buildKustomization(
  yaml: YamlModule,
  manifests: Record<string, unknown>[],
  draft: KubernetesDraft
) {
  const name = toSlug(draft.appName, 'app')
  const resources = manifests.map(manifest => {
    const record = asRecord(manifest)
    const kind = record ? String(record.kind || 'resource').toLowerCase() : 'resource'
    return `${kind}-${name}.yaml`
  })

  return stringifyYaml(yaml, {
    apiVersion: 'kustomize.config.k8s.io/v1beta1',
    kind: 'Kustomization',
    namespace: toSlug(draft.namespace, 'default'),
    resources,
    images: [
      {
        name: draft.imageName.trim() || 'example/app',
        newTag: draft.imageTag.trim() || 'latest'
      }
    ]
  })
}

function buildHelmValues(yaml: YamlModule, draft: KubernetesDraft) {
  return stringifyYaml(yaml, {
    nameOverride: toSlug(draft.appName, 'app'),
    image: {
      repository: draft.imageName.trim() || 'example/app',
      tag: draft.imageTag.trim() || 'latest'
    },
    replicaCount: toInt(draft.replicas, 1),
    service: {
      type: draft.serviceType,
      port: 80,
      targetPort: toInt(draft.containerPort, 3000)
    },
    ingress: {
      enabled: draft.includeIngress,
      host: draft.ingressHost.trim() || `${toSlug(draft.appName, 'app')}.example.com`,
      tls: !draft.publicIngress
    },
    autoscaling: {
      enabled: draft.includeHpa
    },
    podDisruptionBudget: {
      enabled: draft.includePdb
    },
    networkPolicy: {
      enabled: draft.includeNetworkPolicy
    },
    securityContext: {
      runAsNonRoot: draft.runAsNonRoot,
      readOnlyRootFilesystem: draft.readOnlyRootFilesystem
    },
    resources: draft.useResources
      ? {
          requests: { cpu: draft.cpuRequest, memory: draft.memoryRequest },
          limits: { cpu: draft.cpuLimit, memory: draft.memoryLimit }
        }
      : {}
  })
}

function buildKubectlCommands(draft: KubernetesDraft) {
  const namespace = toSlug(draft.namespace, 'default')
  const name = toSlug(draft.appName, 'app')

  return [
    `kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`,
    'kubectl apply -f k8s/',
    `kubectl -n ${namespace} rollout status deploy/${name}`,
    `kubectl -n ${namespace} get deploy,svc,ingress,hpa,pdb,networkpolicy`,
    `kubectl -n ${namespace} describe pod -l app.kubernetes.io/name=${name}`
  ].join('\n')
}

function buildMarkdown(
  draft: KubernetesDraft,
  manifests: Record<string, unknown>[],
  findings: Finding[]
) {
  const name = toSlug(draft.appName, 'app')

  return [
    `# ${name} Kubernetes plan`,
    '',
    `- Namespace: ${toSlug(draft.namespace, 'default')}`,
    `- Image: ${draft.imageName.trim() || 'example/app'}:${draft.imageTag.trim() || 'latest'}`,
    `- Workload: ${draft.workloadType}`,
    `- Service: ${draft.includeService ? draft.serviceType : 'disabled'}`,
    `- Ingress TLS: ${draft.includeIngress && !draft.publicIngress ? 'enabled' : 'review'}`,
    `- Generated resources: ${manifests.length}`,
    `- Audit findings: ${findings.length}`,
    '',
    '## Next checks',
    '',
    '- Pin immutable image tags before production rollout.',
    '- Apply manifests in a staging namespace first.',
    '- Confirm probes, resource requests, security context, and network policy after deploy.',
    '- Keep real Secret values out of source control.'
  ].join('\n')
}

function getContainers(resource: Record<string, unknown>) {
  const kind = getString(resource, 'kind')
  const paths =
    kind === 'CronJob'
      ? [['spec', 'jobTemplate', 'spec', 'template', 'spec', 'containers']]
      : [
          ['spec', 'template', 'spec', 'containers'],
          ['spec', 'containers']
        ]

  for (const path of paths) {
    const containers = getArrayAt(resource, path)
    if (containers.length > 0)
      return containers.map(asRecord).filter(Boolean) as Record<string, unknown>[]
  }

  return []
}

function parseReplicas(resource: Record<string, unknown>) {
  const spec = getRecordAt(resource, ['spec'])
  if (!spec) return null
  const replicas = spec.replicas
  return typeof replicas === 'number' ? replicas : null
}

function parseEnvSecrets(containers: Record<string, unknown>[]) {
  const sensitive = new Set<string>()
  const pattern = /(SECRET|TOKEN|KEY|PASSWORD|DATABASE|PRIVATE|CREDENTIAL)/iu

  for (const container of containers) {
    const env = container.env
    if (!Array.isArray(env)) continue

    for (const item of env) {
      const envRecord = asRecord(item)
      if (!envRecord) continue
      const name = String(envRecord.name || '')
      if (pattern.test(name) && typeof envRecord.value === 'string' && envRecord.value.trim()) {
        sensitive.add(name)
      }
    }
  }

  return Array.from(sensitive)
}

function parseKubernetesWorkspace(yaml: YamlModule, input: string): ParsedKubernetes {
  const source = input.slice(0, WORKSPACE_LIMIT)
  const capped = input.length > WORKSPACE_LIMIT
  const errors: string[] = []
  const kinds: Record<string, number> = {}
  const resources: ParsedResource[] = []

  if (!source.trim()) {
    return { capped, errors, kinds, resources }
  }

  try {
    const documents = yaml.parseAllDocuments(source)

    for (const document of documents) {
      if (document.errors.length > 0) {
        errors.push(document.errors.map(error => error.message).join('; '))
        continue
      }

      const value = document.toJSON()
      const resource = asRecord(value)
      if (!resource) continue

      const metadata = getRecordAt(resource, ['metadata'])
      const spec = getRecordAt(resource, ['spec'])
      const kind = getString(resource, 'kind') || 'Unknown'
      const containers = getContainers(resource)
      const images = containers.map(container => String(container.image || '')).filter(Boolean)
      const hasProbes = containers.some(container =>
        Boolean(container.readinessProbe || container.livenessProbe || container.startupProbe)
      )
      const hasResources = containers.some(container => Boolean(container.resources))
      const hasSecurityContext =
        containers.some(container => Boolean(container.securityContext)) ||
        Boolean(getRecordAt(resource, ['spec', 'template', 'spec', 'securityContext']))
      const serviceType = kind === 'Service' && spec ? String(spec.type || 'ClusterIP') : ''
      const hasIngressTls =
        kind === 'Ingress' && spec ? Array.isArray(spec.tls) && spec.tls.length > 0 : false
      const hasNetworkPolicy = kind === 'NetworkPolicy'
      const namespace = metadata ? String(metadata.namespace || '') : ''
      const name = metadata ? String(metadata.name || kind) : kind

      kinds[kind] = (kinds[kind] || 0) + 1
      resources.push({
        containerCount: containers.length,
        hasIngressTls,
        hasNetworkPolicy,
        hasProbes,
        hasResources,
        hasSecurityContext,
        images,
        kind,
        name,
        namespace,
        plaintextSensitiveEnv: parseEnvSecrets(containers),
        replicas: parseReplicas(resource),
        serviceType
      })
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Invalid YAML')
  }

  return { capped, errors, kinds, resources }
}

function auditDraft(draft: KubernetesDraft, parsed: ParsedKubernetes): Finding[] {
  const findings: Finding[] = []
  const imageTag = draft.imageTag.trim()
  const replicas = toInt(draft.replicas, 1)
  const hasWorkload = draft.workloadType === 'cronjob' || draft.includeCronJob

  if (!draft.appName.trim()) findings.push({ key: 'app_missing', level: 'danger', subject: 'app' })
  if (!draft.namespace.trim())
    findings.push({ key: 'namespace_missing', level: 'warn', subject: 'namespace' })
  if (!draft.imageName.trim())
    findings.push({ key: 'image_missing', level: 'danger', subject: 'image' })
  if (!imageTag || imageTag === 'latest')
    findings.push({ key: 'latest_tag', level: 'warn', subject: imageTag || 'missing' })
  if (!hasWorkload && replicas < 2)
    findings.push({ key: 'single_replica', level: 'warn', subject: String(replicas) })
  if (!draft.useProbes)
    findings.push({ key: 'probes_missing', level: 'warn', subject: draft.appName || 'app' })
  if (!draft.useResources)
    findings.push({ key: 'resources_missing', level: 'warn', subject: draft.appName || 'app' })
  if (!draft.runAsNonRoot)
    findings.push({ key: 'non_root_missing', level: 'danger', subject: draft.appName || 'app' })
  if (!draft.readOnlyRootFilesystem)
    findings.push({ key: 'readonly_missing', level: 'warn', subject: draft.appName || 'app' })
  if (draft.includeService && draft.serviceType !== 'ClusterIP')
    findings.push({ key: 'public_service', level: 'warn', subject: draft.serviceType })
  if (draft.includeIngress && draft.publicIngress)
    findings.push({
      key: 'ingress_tls_missing',
      level: 'warn',
      subject: draft.ingressHost || 'ingress'
    })
  if (!draft.includeNetworkPolicy)
    findings.push({
      key: 'network_policy_missing',
      level: 'warn',
      subject: draft.namespace || 'namespace'
    })
  if (!draft.includeHpa && !hasWorkload)
    findings.push({ key: 'hpa_missing', level: 'warn', subject: draft.appName || 'app' })
  if (!draft.includePdb && !hasWorkload)
    findings.push({ key: 'pdb_missing', level: 'warn', subject: draft.appName || 'app' })
  if (toLines(draft.secretKeys).length > 0 && !draft.includeSecret)
    findings.push({ key: 'secret_missing', level: 'danger', subject: 'Secret' })

  if (parsed.capped)
    findings.push({ key: 'workspace_capped', level: 'warn', subject: `${WORKSPACE_LIMIT}` })
  if (parsed.errors.length > 0)
    findings.push({ key: 'invalid_yaml', level: 'danger', subject: parsed.errors[0] || 'YAML' })
  if (parsed.resources.length === 0 && !parsed.errors.length)
    findings.push({ key: 'parser_empty', level: 'warn', subject: 'workspace' })

  for (const resource of parsed.resources) {
    for (const image of resource.images) {
      if (!image.includes(':') || image.endsWith(':latest')) {
        findings.push({
          key: 'parsed_latest',
          level: 'warn',
          subject: `${resource.name}: ${image}`
        })
      }
    }

    if (['Deployment', 'StatefulSet', 'DaemonSet', 'CronJob'].includes(resource.kind)) {
      if (!resource.hasProbes && resource.kind !== 'CronJob')
        findings.push({ key: 'parsed_no_probes', level: 'warn', subject: resource.name })
      if (!resource.hasResources)
        findings.push({ key: 'parsed_no_resources', level: 'warn', subject: resource.name })
      if (!resource.hasSecurityContext)
        findings.push({ key: 'parsed_no_security', level: 'danger', subject: resource.name })
      if (resource.replicas === 1)
        findings.push({ key: 'parsed_single_replica', level: 'warn', subject: resource.name })
    }

    if (resource.serviceType === 'LoadBalancer' || resource.serviceType === 'NodePort') {
      findings.push({
        key: 'parsed_public_service',
        level: 'warn',
        subject: `${resource.name}: ${resource.serviceType}`
      })
    }

    if (resource.kind === 'Ingress' && !resource.hasIngressTls) {
      findings.push({ key: 'parsed_ingress_no_tls', level: 'warn', subject: resource.name })
    }

    if (resource.plaintextSensitiveEnv.length > 0) {
      findings.push({
        key: 'parsed_plain_secret',
        level: 'danger',
        subject: `${resource.name}: ${resource.plaintextSensitiveEnv.join(', ')}`
      })
    }
  }

  if (
    !parsed.resources.some(resource => resource.hasNetworkPolicy) &&
    parsed.resources.length > 0
  ) {
    findings.push({ key: 'parsed_no_network_policy', level: 'warn', subject: 'NetworkPolicy' })
  }

  if (findings.length === 0) {
    findings.push({ key: 'baseline_ok', level: 'good', subject: draft.appName || 'app' })
  }

  return findings
}

function buildCsv(findings: Finding[]) {
  return [
    'level,subject,key',
    ...findings.map(item =>
      [item.level, item.subject, item.key]
        .map(value => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    )
  ].join('\n')
}

function getOutputFilename(outputType: OutputType) {
  if (outputType === 'manifests') return 'kubernetes-manifests.yaml'
  if (outputType === 'kustomization') return 'kustomization.yaml'
  if (outputType === 'helm') return 'values.yaml'
  if (outputType === 'kubectl') return 'kubectl-commands.sh'
  if (outputType === 'json') return 'kubernetes-summary.json'
  return 'kubernetes-plan.md'
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-panel min-w-0 rounded-2xl p-4">
      <p className="text-xs font-medium uppercase text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

export default function KubernetesClient() {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [draft, setDraft] = useState<KubernetesDraft>(DEFAULT_DRAFT)
  const [workspace, setWorkspace] = useState(PRESETS[0].workspace)
  const [isWorkspaceCapped, setIsWorkspaceCapped] = useState(false)
  const [auditQuery, setAuditQuery] = useState('')
  const [outputType, setOutputType] = useState<OutputType>('manifests')
  const [yamlModule, setYamlModule] = useState<YamlModule | null>(null)
  const deferredWorkspace = useDeferredValue(workspace)

  useEffect(() => {
    let isCurrent = true
    void import('yaml').then(module => {
      if (isCurrent) setYamlModule(module)
    })

    return () => {
      isCurrent = false
    }
  }, [])

  const isYamlReady = Boolean(yamlModule)
  const manifests = useMemo(() => buildManifests(draft), [draft])
  const manifestYaml = useMemo(
    () => (yamlModule ? manifestsToYaml(yamlModule, manifests) : ''),
    [manifests, yamlModule]
  )
  const parsed = useMemo(() => {
    const next = yamlModule
      ? parseKubernetesWorkspace(yamlModule, deferredWorkspace)
      : EMPTY_PARSED_KUBERNETES

    return isWorkspaceCapped ? { ...next, capped: true } : next
  }, [deferredWorkspace, isWorkspaceCapped, yamlModule])
  const findings = useMemo(() => auditDraft(draft, parsed), [draft, parsed])
  const csvOutput = useMemo(() => buildCsv(findings), [findings])
  const buildCurrentOutput = useCallback(() => {
    if (!yamlModule) return ''
    if (outputType === 'manifests') return manifestYaml
    if (outputType === 'kustomization') return buildKustomization(yamlModule, manifests, draft)
    if (outputType === 'helm') return buildHelmValues(yamlModule, draft)
    if (outputType === 'kubectl') return buildKubectlCommands(draft)
    if (outputType === 'json') {
      return JSON.stringify(
        { draft, findings, kinds: parsed.kinds, resources: parsed.resources },
        null,
        2
      )
    }
    return buildMarkdown(draft, manifests, findings)
  }, [
    draft,
    findings,
    manifestYaml,
    manifests,
    outputType,
    parsed.kinds,
    parsed.resources,
    yamlModule
  ])
  const jsonPreviewResources = useMemo(
    () => parsed.resources.slice(0, OUTPUT_PREVIEW_ROWS),
    [parsed.resources]
  )
  const jsonPreviewResourcesLimited =
    outputType === 'json' && parsed.resources.length > jsonPreviewResources.length
  const outputPreviewSource = useMemo(() => {
    if (outputType !== 'json') return buildCurrentOutput()

    return JSON.stringify(
      {
        draft,
        findings,
        kinds: parsed.kinds,
        resources: jsonPreviewResources,
        resourcesPreview: jsonPreviewResourcesLimited
          ? {
              total: parsed.resources.length,
              visible: jsonPreviewResources.length
            }
          : undefined
      },
      null,
      2
    )
  }, [
    buildCurrentOutput,
    draft,
    findings,
    jsonPreviewResources,
    jsonPreviewResourcesLimited,
    outputType,
    parsed.kinds,
    parsed.resources.length
  ])
  const outputPreview = useMemo(
    () => createOutputPreview(outputPreviewSource),
    [outputPreviewSource]
  )
  const outputPreviewCharsLimited = isOutputPreviewLimited(outputPreviewSource)

  const filteredFindings = useMemo(() => {
    const query = auditQuery.trim().toLowerCase()
    if (!query) return findings

    return findings.filter(item =>
      `${item.key} ${item.subject} ${t(`app.generation.kubernetes.audit.${item.key}`)}`
        .toLowerCase()
        .includes(query)
    )
  }, [auditQuery, findings, t])
  const visibleFindings = useMemo(
    () => filteredFindings.slice(0, FINDING_RENDER_LIMIT),
    [filteredFindings]
  )
  const findingsLimited = filteredFindings.length > visibleFindings.length
  const visibleParsedResources = useMemo(
    () => parsed.resources.slice(0, PARSED_RENDER_LIMIT),
    [parsed.resources]
  )
  const parsedResourcesLimited = parsed.resources.length > visibleParsedResources.length

  const metrics = useMemo(() => {
    const danger = findings.filter(item => item.level === 'danger').length
    const warn = findings.filter(item => item.level === 'warn').length
    const workloadCount = manifests.filter(manifest =>
      ['Deployment', 'StatefulSet', 'CronJob'].includes(String(manifest.kind))
    ).length

    return {
      critical: danger,
      namespaces: new Set(parsed.resources.map(item => item.namespace).filter(Boolean)).size || 1,
      resources: manifests.length,
      status:
        danger > 0
          ? t('app.generation.kubernetes.status.risk')
          : warn > 0
            ? t('app.generation.kubernetes.status.review')
            : t('app.generation.kubernetes.status.ready'),
      warnings: warn,
      workloads: workloadCount
    }
  }, [findings, manifests, parsed.resources, t])

  const updateDraft = useCallback(
    <K extends keyof KubernetesDraft>(key: K, value: KubernetesDraft[K]) => {
      const stringLimit =
        key === 'configKeys' || key === 'secretKeys' ? KEY_LIST_INPUT_LIMIT : DRAFT_FIELD_LIMIT
      const nextValue =
        typeof value === 'string' ? (value.slice(0, stringLimit) as KubernetesDraft[K]) : value
      setDraft(current => ({ ...current, [key]: nextValue }))
    },
    []
  )

  const updateWorkspace = useCallback((value: string) => {
    const capped = value.length > WORKSPACE_LIMIT

    setIsWorkspaceCapped(capped)
    setWorkspace(capped ? value.slice(0, WORKSPACE_LIMIT) : value)
  }, [])

  const applyPreset = useCallback(
    (preset: Preset) => {
      setDraft(preset.draft)
      updateWorkspace(preset.workspace)
    },
    [updateWorkspace]
  )

  const reset = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
    updateWorkspace(PRESETS[0].workspace)
    setAuditQuery('')
    setOutputType('manifests')
  }, [updateWorkspace])

  const copySummary = useCallback(() => {
    copy(
      [
        t('app.generation.kubernetes.summary_title'),
        `${t('app.generation.kubernetes.metric.status')}: ${metrics.status}`,
        `${t('app.generation.kubernetes.metric.resources')}: ${metrics.resources}`,
        `${t('app.generation.kubernetes.metric.workloads')}: ${metrics.workloads}`,
        `${t('app.generation.kubernetes.metric.warnings')}: ${metrics.warnings}`,
        `${t('app.generation.kubernetes.metric.critical')}: ${metrics.critical}`
      ].join('\n')
    )
  }, [copy, metrics, t])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
                  <Boxes className="h-3.5 w-3.5" />
                  {t('app.generation.kubernetes')}
                </div>
                <CardTitle className="mt-2 text-2xl">{t('app.generation.kubernetes')}</CardTitle>
                <CardDescription>{t('app.generation.kubernetes.description')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={copySummary}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {t('app.generation.kubernetes.copy_summary')}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('public.reset')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label={t('app.generation.kubernetes.metric.status')} value={metrics.status} />
            <Metric
              label={t('app.generation.kubernetes.metric.resources')}
              value={metrics.resources}
            />
            <Metric
              label={t('app.generation.kubernetes.metric.workloads')}
              value={metrics.workloads}
            />
            <Metric
              label={t('app.generation.kubernetes.metric.namespaces')}
              value={metrics.namespaces}
            />
            <Metric
              label={t('app.generation.kubernetes.metric.warnings')}
              value={metrics.warnings}
            />
            <Metric
              label={t('app.generation.kubernetes.metric.critical')}
              value={metrics.critical}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.kubernetes.presets')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className="glass-input min-w-0 rounded-2xl p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--primary)]"
              >
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  {t(`app.generation.kubernetes.preset.${preset.key}`)}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">
                  {t(`app.generation.kubernetes.preset.${preset.key}_hint`)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.kubernetes.builder')}</CardTitle>
              <CardDescription>{t('app.generation.kubernetes.builder_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="kube-app">{t('app.generation.kubernetes.app_name')}</Label>
                  <Input
                    id="kube-app"
                    value={draft.appName}
                    onChange={event => updateDraft('appName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-namespace">{t('app.generation.kubernetes.namespace')}</Label>
                  <Input
                    id="kube-namespace"
                    value={draft.namespace}
                    onChange={event => updateDraft('namespace', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-workload">
                    {t('app.generation.kubernetes.workload_type')}
                  </Label>
                  <Select
                    id="kube-workload"
                    value={draft.workloadType}
                    onChange={event =>
                      updateDraft('workloadType', event.target.value as WorkloadType)
                    }
                  >
                    {WORKLOAD_TYPES.map(type => (
                      <option key={type} value={type}>
                        {t(`app.generation.kubernetes.workload.${type}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-image">{t('app.generation.kubernetes.image_name')}</Label>
                  <Input
                    id="kube-image"
                    value={draft.imageName}
                    onChange={event => updateDraft('imageName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-tag">{t('app.generation.kubernetes.image_tag')}</Label>
                  <Input
                    id="kube-tag"
                    value={draft.imageTag}
                    onChange={event => updateDraft('imageTag', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-replicas">{t('app.generation.kubernetes.replicas')}</Label>
                  <Input
                    id="kube-replicas"
                    value={draft.replicas}
                    onChange={event => updateDraft('replicas', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-port">{t('app.generation.kubernetes.container_port')}</Label>
                  <Input
                    id="kube-port"
                    value={draft.containerPort}
                    onChange={event => updateDraft('containerPort', event.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-service">
                    {t('app.generation.kubernetes.service_type')}
                  </Label>
                  <Select
                    id="kube-service"
                    value={draft.serviceType}
                    onChange={event =>
                      updateDraft('serviceType', event.target.value as ServiceType)
                    }
                  >
                    {SERVICE_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-health">{t('app.generation.kubernetes.health_path')}</Label>
                  <Input
                    id="kube-health"
                    value={draft.healthPath}
                    onChange={event => updateDraft('healthPath', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-host">{t('app.generation.kubernetes.ingress_host')}</Label>
                  <Input
                    id="kube-host"
                    value={draft.ingressHost}
                    onChange={event => updateDraft('ingressHost', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-path">{t('app.generation.kubernetes.path_prefix')}</Label>
                  <Input
                    id="kube-path"
                    value={draft.pathPrefix}
                    onChange={event => updateDraft('pathPrefix', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-schedule">{t('app.generation.kubernetes.schedule')}</Label>
                  <Input
                    id="kube-schedule"
                    value={draft.schedule}
                    onChange={event => updateDraft('schedule', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-cpu-request">
                    {t('app.generation.kubernetes.cpu_request')}
                  </Label>
                  <Input
                    id="kube-cpu-request"
                    value={draft.cpuRequest}
                    onChange={event => updateDraft('cpuRequest', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-cpu-limit">{t('app.generation.kubernetes.cpu_limit')}</Label>
                  <Input
                    id="kube-cpu-limit"
                    value={draft.cpuLimit}
                    onChange={event => updateDraft('cpuLimit', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-memory-request">
                    {t('app.generation.kubernetes.memory_request')}
                  </Label>
                  <Input
                    id="kube-memory-request"
                    value={draft.memoryRequest}
                    onChange={event => updateDraft('memoryRequest', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="kube-memory-limit">
                    {t('app.generation.kubernetes.memory_limit')}
                  </Label>
                  <Input
                    id="kube-memory-limit"
                    value={draft.memoryLimit}
                    onChange={event => updateDraft('memoryLimit', event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="kube-config">{t('app.generation.kubernetes.config_keys')}</Label>
                  <Textarea
                    id="kube-config"
                    value={draft.configKeys}
                    onChange={event =>
                      updateDraft('configKeys', event.target.value.slice(0, KEY_LIST_INPUT_LIMIT))
                    }
                    className="min-h-24 font-mono"
                  />
                  <InputCapNotice
                    visible={draft.configKeys.length >= KEY_LIST_INPUT_LIMIT}
                    limit={KEY_LIST_INPUT_LIMIT}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="kube-secrets">{t('app.generation.kubernetes.secret_keys')}</Label>
                  <Textarea
                    id="kube-secrets"
                    value={draft.secretKeys}
                    onChange={event =>
                      updateDraft('secretKeys', event.target.value.slice(0, KEY_LIST_INPUT_LIMIT))
                    }
                    className="min-h-24 font-mono"
                  />
                  <InputCapNotice
                    visible={draft.secretKeys.length >= KEY_LIST_INPUT_LIMIT}
                    limit={KEY_LIST_INPUT_LIMIT}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Checkbox
                  checked={draft.includeService}
                  onChange={event => updateDraft('includeService', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_service')}
                />
                <Checkbox
                  checked={draft.includeIngress}
                  onChange={event => updateDraft('includeIngress', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_ingress')}
                />
                <Checkbox
                  checked={draft.publicIngress}
                  onChange={event => updateDraft('publicIngress', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.public_ingress')}
                />
                <Checkbox
                  checked={draft.includeConfigMap}
                  onChange={event => updateDraft('includeConfigMap', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_configmap')}
                />
                <Checkbox
                  checked={draft.includeSecret}
                  onChange={event => updateDraft('includeSecret', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_secret')}
                />
                <Checkbox
                  checked={draft.includeServiceAccount}
                  onChange={event => updateDraft('includeServiceAccount', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_service_account')}
                />
                <Checkbox
                  checked={draft.includeHpa}
                  onChange={event => updateDraft('includeHpa', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_hpa')}
                />
                <Checkbox
                  checked={draft.includePdb}
                  onChange={event => updateDraft('includePdb', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_pdb')}
                />
                <Checkbox
                  checked={draft.includeNetworkPolicy}
                  onChange={event => updateDraft('includeNetworkPolicy', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_network_policy')}
                />
                <Checkbox
                  checked={draft.includeCronJob}
                  onChange={event => updateDraft('includeCronJob', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.include_cronjob')}
                />
                <Checkbox
                  checked={draft.useProbes}
                  onChange={event => updateDraft('useProbes', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.use_probes')}
                />
                <Checkbox
                  checked={draft.useResources}
                  onChange={event => updateDraft('useResources', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.use_resources')}
                />
                <Checkbox
                  checked={draft.runAsNonRoot}
                  onChange={event => updateDraft('runAsNonRoot', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.run_as_non_root')}
                />
                <Checkbox
                  checked={draft.readOnlyRootFilesystem}
                  onChange={event => updateDraft('readOnlyRootFilesystem', event.target.checked)}
                  className="glass-input min-w-0 rounded-xl px-3 py-2"
                  label={t('app.generation.kubernetes.readonly_root')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('app.generation.kubernetes.workspace')}
              </CardTitle>
              <CardDescription>{t('app.generation.kubernetes.workspace_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea
                value={workspace}
                onChange={event => updateWorkspace(event.target.value)}
                placeholder={t('app.generation.kubernetes.workspace_placeholder')}
                className="min-h-[520px] font-mono"
                spellCheck={false}
              />
              <InputCapNotice visible={isWorkspaceCapped} limit={WORKSPACE_LIMIT} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => copy(workspace)}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('public.copy')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isYamlReady}
                  onClick={() => updateWorkspace(manifestYaml)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('app.generation.kubernetes.use_output')}
                </Button>
                <Button type="button" variant="outline" onClick={() => updateWorkspace('')}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('public.clear')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 content-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.kubernetes.audit')}</CardTitle>
              <CardDescription>{t('app.generation.kubernetes.audit_hint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={auditQuery}
                  onChange={event => setAuditQuery(event.target.value.slice(0, 160))}
                  placeholder={t('app.generation.kubernetes.audit_search')}
                  className="pl-10"
                />
              </div>
              <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
                {visibleFindings.map((finding, index) => (
                  <div
                    key={`${finding.key}-${finding.subject}-${index}`}
                    className="glass-panel rounded-2xl p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all font-mono text-sm font-semibold leading-5 text-[var(--text-primary)]">
                          {finding.subject}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                          {t(`app.generation.kubernetes.audit.${finding.key}`)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs font-medium">
                        {t(`app.generation.kubernetes.level.${finding.level}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {findingsLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.rows_render_limited', {
                    total: filteredFindings.length,
                    visible: visibleFindings.length
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    {t('app.generation.kubernetes.output')}
                  </CardTitle>
                  <CardDescription>
                    {isYamlReady ? t('app.generation.kubernetes.output_hint') : t('public.loading')}
                  </CardDescription>
                </div>
                <ShieldCheck className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="kube-output">{t('app.generation.kubernetes.output_type')}</Label>
                <Select
                  id="kube-output"
                  value={outputType}
                  onChange={event => setOutputType(event.target.value as OutputType)}
                >
                  {OUTPUT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {t(`app.generation.kubernetes.output.${type}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                value={isYamlReady ? outputPreview : t('public.loading')}
                readOnly
                className="min-h-[360px] font-mono"
                spellCheck={false}
              />
              {jsonPreviewResourcesLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.output_preview_rows_limited', {
                    total: parsed.resources.length.toLocaleString(),
                    visible: jsonPreviewResources.length.toLocaleString()
                  })}
                </p>
              )}
              {outputPreviewCharsLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.output_preview_limited', {
                    total: outputPreviewSource.length.toLocaleString(),
                    visible: OUTPUT_PREVIEW_CHARS.toLocaleString()
                  })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isYamlReady}
                  onClick={() => copy(buildCurrentOutput())}
                  className="w-full sm:w-auto"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('app.generation.kubernetes.copy_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isYamlReady}
                  onClick={() => downloadText(buildCurrentOutput(), getOutputFilename(outputType))}
                  className="w-full sm:w-auto"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('app.generation.kubernetes.download_output')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isYamlReady}
                  onClick={() =>
                    downloadText(csvOutput, 'kubernetes-audit.csv', 'text/csv;charset=utf-8')
                  }
                  className="w-full sm:w-auto"
                >
                  <FileCode2 className="mr-2 h-4 w-4" />
                  {t('app.generation.kubernetes.download_csv')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('app.generation.kubernetes.parsed')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {visibleParsedResources.map((resource, index) => (
                <div
                  key={`${resource.kind}-${resource.name}-${index}`}
                  className="glass-panel rounded-2xl p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-semibold leading-5">
                        {resource.kind}/{resource.name}
                      </p>
                      <p className="break-all font-mono text-xs leading-5 text-[var(--text-muted)]">
                        {resource.namespace || 'default'}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs">
                      {resource.containerCount} {t('app.generation.kubernetes.parsed.containers')}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[var(--text-muted)]">
                    <p className="break-all font-mono leading-5">
                      {t('app.generation.kubernetes.parsed.images')}:{' '}
                      {resource.images.join(', ') || '-'}
                    </p>
                    <p>
                      {t('app.generation.kubernetes.parsed.probes')}:{' '}
                      {resource.hasProbes ? t('public.yes') : t('public.no')}
                    </p>
                    <p>
                      {t('app.generation.kubernetes.parsed.resources')}:{' '}
                      {resource.hasResources ? t('public.yes') : t('public.no')}
                    </p>
                    <p className="break-all font-mono leading-5">
                      {t('app.generation.kubernetes.parsed.secrets')}:{' '}
                      {resource.plaintextSensitiveEnv.join(', ') || '-'}
                    </p>
                  </div>
                </div>
              ))}
              {parsedResourcesLimited && (
                <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">
                  {t('public.rows_render_limited', {
                    total: parsed.resources.length,
                    visible: visibleParsedResources.length
                  })}
                </p>
              )}
              {parsed.resources.length === 0 && (
                <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">
                  <AlertTriangle className="h-4 w-4" />
                  {t('app.generation.kubernetes.empty')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('app.generation.kubernetes.reference')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {['probes', 'resources', 'security', 'network', 'autoscaling'].map(item => (
                <div key={item} className="flex gap-3">
                  <Network className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {t(`app.generation.kubernetes.reference.${item}`)}
                    </p>
                    <p className="text-xs leading-5 text-[var(--text-muted)]">
                      {t(`app.generation.kubernetes.reference.${item}_hint`)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
