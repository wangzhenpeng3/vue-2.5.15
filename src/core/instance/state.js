/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
/**
 *
 * @param {Vue实例} target
 * @param {_data} sourceKey
 * @param {data中的key值} key
 */
// 这个方法将_props或者_data中的属性添加到Vue实例上，当我们访问或者修改时(this.propsKey this.dataKey)实际上就是访问this._props.propsKey this._data.dataKey
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    // console.log(this[sourceKey][key], 'this=====>', this, target)
    // debugger
    return this[sourceKey][key] // this._props.key 或者 this.data.key
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    // debugger
    this[sourceKey][key] = val
  }
  // debugger
  // console.log('this=====>', this, sourceKey, target)
  /**
   * Object.defineProperty(target, key, {
   *  enumerable: true,
   *  configurable: true,
   *  get: proxyGetter () { return this[sourceKey][key] }, this指向Proxy函数，this可以访问vm上属性及方法
   *  set: function proxySetter (val) { return this[sourceKey][key] = val }
   * })
   *  */
  Object.defineProperty(target, key, sharedPropertyDefinition) // 往Vue对象上添加新的属性并且(就是将_data中的属性添加到Vue对象上),并且修改&获取中的会触发set get方法
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 1.props开启响应式.
  // 2.代理props,使其通过this.propsKey的方式能访问到.
  if (opts.props) initProps(vm, opts.props)
  // 1.判重，校验propsKey中是否含有methodsKey，propsKey优先级高于methodsKey.
  // 2.支持通过this.methodsKey访问方法，实现方式:在Vue实例上添加methodsKey并赋值methodsValue
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
  // 1.执行data函数,取得data对象 优点: 防止data收到污染
  // 1.判重,优先级methodsKey高于propsKey
  // 2.代理data,使其通过this.dataKey访问到。
  // 3.data开启响应式。
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  /**
   * 1. computed是通过对每一个computedKey添加的Watcher来实现的,默认为懒加载.
   * 2. 代理,将computed属性代理到Vue实例上,使其可以通过this.computedKey来执行computed中的方法.
   * 3. 通过dirty属性来实现,computed属性值缓存机制.
   * 4. 缓存机制实现原理是:
   *    dirty = true, 执行 watcher.evaluate()方法-> this.value = this.get() this.dirty = false. 当data中的数据发生变化时，执行this.update() -> this.dirty = ture
   * 5. computed和methods的区别, computed在data不发生更新时，只执行一次.而methods执行多次.
   */
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    /**
     * 1. 实例化一个Watch, 并返回一个unwatch的一个方法
     */
    initWatch(vm, opts.watch)
    /**
     * computed和watch有什么区别?
     * 1. 场景区别， watch支持异步操作,computed不支持
     * 2. computed默认为懒加载并且不支持修改. watch是可以配置的
     */
  }
}

function initProps (vm: Component, propsOptions: Object) {
  debugger
  const propsData = vm.$options.propsData || {} // props的配置
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    // Help这个方法没看懂
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 开启响应式
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key) // 将props上的对象属性添加到Vue对象上，从而达到this[props]能访问到
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  // data() {return {msg: 'hellp Vue'}}
  let data = vm.$options.data // 是一个function函数
  // console.log(data, 'datadatadatadatadatadatadatadata==>')

  data = vm._data = typeof data === 'function'
    ? getData(data, vm) // 执行了.call() 获取到data中的返回值 -> {msg: 'hellp Vue'}
    : data || {} // 在vm添加_data对象，给对象是data函数的返回值
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  /**
   * 将对象的key值转成数组
   * 例如:
   *  Object.keys(data) -> ['msg']
   */
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props // undefined
  const methods = vm.$options.methods // undefined
  let i = keys.length // 获取数组长度
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // 判断 methods这个对象上含有这个key值。
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 判断 props这个对象上含有这个data值
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    // 以上两个判断，主要作用是防止methods和props与data重复声明，发生重复声明Vue会警告。
    } else if (!isReserved(key)) { // 防止变量名称命名成$开头或者_开头,与Vue上的实例方法和属性冲突。
      proxy(vm, `_data`, key) // 代理
    }
  }
  // console.log(data, 'datadatadata')
  // debugger
  // observe data
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget() // Help 这个块没有看懂
  try {
    // debugger
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget() // Help 这个块没有看懂
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 为每个computedKey添加一个实例化Watcher,默认懒加载
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 代理computed到Vue实例上,使其可以通过this.computedKey来访问
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      /**
       * watcher缓存的实现原理:
       * 通过dirty=true时,执行watcher.evaluate()，这里evaluate方法主要做了两件事，一个是执行this.get()获取新的value值，并将新的值赋值给this.value. 另一个是将dirty赋值为false.
       * 当dirty=false时,则返回缓存值。并不执行this.get()方法.
       * 如何做到dirty=true,只有computed的依赖值发生变化的时候会执行this.updata()方法时候，才将dirty赋值为true.
       * computed和methods方法有什么区别?
       * computed在渲染的时候只执行一次, methods方法会执行多次.
       */
      if (watcher.dirty) {
        watcher.evaluate()
      }
      // Help 不清楚
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  // 判重处理， propsKey优先级高于methodsKye
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 以上方法是校验methods中的方法不能为空、props上的key是否和methods中key重名，或者key命名不能以$或者_开头
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm) // 在Vue实例上添加methodsKey属性，并将对应的methodsValue复制给methodsKey,使其能通过this.methodsKey访问
  }
}

function initWatch (vm: Component, watch: Object) {
  // 遍历watch
  for (const key in watch) {
    const handler = watch[key] // 拿到value
    // 注意 watch的值可以是 Object String Array Function
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 这里判断时候不是value是不是对象
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 这里判断是不是string.
  if (typeof handler === 'string') {
    handler = vm[handler] // 是String就将handler赋值为this.methodsKey
  }
  // key, value, options
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // 判断value是否为Object
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options) // value还是对象就才执行一次createWatcher,这里最终value !== Object
    }
    //
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      cb.call(vm, watcher.value) // 执行函数
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
