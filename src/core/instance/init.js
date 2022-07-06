/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0 //  全局变量

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this // 缓存当前的this
    // a uid
    vm._uid = uid++ // 每次Vue实例都有一个_uid并且一次递增的。

    // a flag to avoid this being observed
    vm._isVue = true // 防止this被observed实例化
    // merge options
    /**
     * TODO Help ?
     * 1.mergeOptions resolveConstructorOptions 不明白具体是干什么的
     * 2.vm.constructor 构造函数指向哪个
     * 3.vm上什么时候多了以下属性及方法
     * compile: ƒ compileToFunctions( template, options, vm )
     * component: ƒ ( id, definition )
     * delete: ƒ del(target, key)
     * directive: ƒ ( id, definition )
     * extend: ƒ (extendOptions)
     * filter: ƒ ( id, definition )
     * mixin: ƒ (mixin)
     *  nextTick: ƒ nextTick(cb, ctx)
     * options: {components: {…}, directives: {…}, filters: {…}, _base: ƒ}
     * set: ƒ (target, key, val)
     * use: ƒ (plugin)
     * util
     */
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options) // TODO 判断是否是子组件，将组件上深层次的配置，放到vm.$opetions中，将属性拉平。避免出现从原型链上查找，提到执行效率。（主要是优化）
    } else {
      /**
       *  TODO
       *  目的是：将全局的组件配置合并到根组件的局部配置里来，比如Vue.component注册的全局组件合并到根实例的component中。
       *  注意: {component: XXX} 在编译器执行时，生成render函数，才将opetions做了合并。包括根组件的component配置。
       */
      // debugger
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), //
        options || {},
        vm
      )
    }
    // debugger
    // console.log(vm, 'vmvmvmvmvmvm')
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 初始化组件实例化关系属性，比如 $parent、$root、$refs、$children等
    initLifecycle(vm)
    /**
     * 初始化自定义事件
     * <cmp @click="hanbleClick"></cmp>
     * this.$emit('click') this.$on('click', function hanbleClick () {})
     * Tips: 谁触发，谁监听。
     * Help 没看懂
     * */
    initEvents(vm)
    // 初始化插槽 $solt _c函数 createElement函数
    initRender(vm)
    // 执行生命周期函数 beforeCreate
    callHook(vm, 'beforeCreate')
    // 初始化inject
    initInjections(vm) // resolve injections before data/props
    /**
     * 初始化 data props methods computed watch
     * 这也是在beforeCreate中data和$el为undefined的原因
     */
    initState(vm)
    // 初始化provide
    initProvide(vm) // resolve provide after data/props
    // 执行生命周期函数 created
    callHook(vm, 'created')
    /**
     * 配置项是否有 el, 如果没有需要手动执行$mount方法
     */
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}
//
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // debugger
  if (Ctor.super) { // TODO Help 什么时候触发? 不清楚
    // debugger
    const superOptions = resolveConstructorOptions(Ctor.super) //
    const cachedSuperOptions = Ctor.superOptions // 缓存当前配置
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor) // 去重
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}
/**
 *
 * @param {Vue构造函数} Ctor
 * @returns 返回新的对象
 * 作用: 将三个配置项，进行去重。然后赋值给新的对象属性。
 */
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key]) // 去重
    }
  }
  return modified
}
// Help 具体逻辑没有看
/**
 *
 * @param {最近的配置项} latest
 * @param {继承的配置项} extended
 * @param {私有的配置项} sealed
 * @returns 数组
 */
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
